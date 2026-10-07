#include "whisper.h"

#include <emscripten.h>
#include <emscripten/bind.h>

#include <algorithm>
#include <atomic>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

static whisper_context * g_context = nullptr;
static std::thread g_worker;
static std::atomic<bool> g_running(false);
static std::mutex g_result_mutex;
static std::string g_result;

static int safe_thread_count() {
    const unsigned int hw = std::thread::hardware_concurrency();
    const int available = hw > 0 ? static_cast<int>(hw) : 1;
    return std::max(1, std::min(4, available));
}

static void join_worker() {
    if (g_worker.joinable()) {
        g_worker.join();
    }
}

EMSCRIPTEN_BINDINGS(versorgungsassistent_whisper) {
    emscripten::function("init", emscripten::optional_override([](const std::string & path_model) {
        join_worker();
        g_running.store(false);

        if (g_context != nullptr) {
            whisper_free(g_context);
            g_context = nullptr;
        }

        g_context = whisper_init_from_file_with_params(
            path_model.c_str(),
            whisper_context_default_params()
        );
        return g_context != nullptr;
    }));

    emscripten::function("free", emscripten::optional_override([]() {
        join_worker();
        g_running.store(false);
        if (g_context != nullptr) {
            whisper_free(g_context);
            g_context = nullptr;
        }
        std::lock_guard<std::mutex> lock(g_result_mutex);
        g_result.clear();
    }));

    emscripten::function("is_running", emscripten::optional_override([]() {
        return g_running.load();
    }));

    emscripten::function("get_result", emscripten::optional_override([]() {
        std::lock_guard<std::mutex> lock(g_result_mutex);
        return g_result;
    }));

    emscripten::function("start_transcribe", emscripten::optional_override([](
        const emscripten::val & audio,
        const std::string & lang,
        bool translate
    ) {
        if (g_context == nullptr) return -1;
        if (g_running.load()) return -2;

        join_worker();

        std::vector<float> pcmf32;
        const int n = audio["length"].as<int>();
        if (n <= 0) return -3;
        pcmf32.resize(n);

        emscripten::val heap = emscripten::val::module_property("HEAPU8");
        emscripten::val memory = heap["buffer"];
        emscripten::val memory_view = audio["constructor"].new_(
            memory,
            reinterpret_cast<uintptr_t>(pcmf32.data()),
            n
        );
        memory_view.call<void>("set", audio);

        {
            std::lock_guard<std::mutex> lock(g_result_mutex);
            g_result.clear();
        }

        g_running.store(true);
        g_worker = std::thread([
            pcm = std::move(pcmf32),
            language = lang,
            translate
        ]() mutable {
            whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
            params.print_realtime = false;
            params.print_progress = false;
            params.print_timestamps = false;
            params.print_special = false;
            params.translate = translate;
            params.language = whisper_is_multilingual(g_context) ? language.c_str() : "en";
            params.n_threads = safe_thread_count();
            params.offset_ms = 0;

            whisper_reset_timings(g_context);
            const int rc = whisper_full(
                g_context,
                params,
                pcm.data(),
                static_cast<int>(pcm.size())
            );

            std::string result;
            if (rc == 0) {
                const int segments = whisper_full_n_segments(g_context);
                for (int i = 0; i < segments; ++i) {
                    const char * segment = whisper_full_get_segment_text(g_context, i);
                    if (segment != nullptr) result += segment;
                }
            }

            {
                std::lock_guard<std::mutex> lock(g_result_mutex);
                g_result = std::move(result);
            }
            g_running.store(false);
        });

        return 0;
    }));
}
