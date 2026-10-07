#include "whisper.h"

#include <emscripten/bind.h>

#include <string>
#include <vector>

static whisper_context * g_context = nullptr;

EMSCRIPTEN_BINDINGS(versorgungsassistent_whisper) {
    emscripten::function("init", emscripten::optional_override([](const std::string & path_model) {
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
        if (g_context != nullptr) {
            whisper_free(g_context);
            g_context = nullptr;
        }
    }));

    emscripten::function("transcribe", emscripten::optional_override([](
        const emscripten::val & audio,
        const std::string & lang,
        bool translate
    ) {
        if (g_context == nullptr) {
            return std::string();
        }

        const int n = audio["length"].as<int>();
        if (n <= 0) {
            return std::string();
        }

        std::vector<float> pcmf32(n);

        emscripten::val heap = emscripten::val::module_property("HEAPU8");
        emscripten::val memory = heap["buffer"];
        emscripten::val memory_view = audio["constructor"].new_(
            memory,
            reinterpret_cast<uintptr_t>(pcmf32.data()),
            n
        );
        memory_view.call<void>("set", audio);

        whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.print_realtime = false;
        params.print_progress = false;
        params.print_timestamps = false;
        params.print_special = false;
        params.translate = translate;
        params.language = whisper_is_multilingual(g_context) ? lang.c_str() : "en";
        params.n_threads = 1;
        params.offset_ms = 0;

        whisper_reset_timings(g_context);
        const int rc = whisper_full(
            g_context,
            params,
            pcmf32.data(),
            static_cast<int>(pcmf32.size())
        );
        if (rc != 0) {
            return std::string();
        }

        std::string result;
        const int segments = whisper_full_n_segments(g_context);
        for (int i = 0; i < segments; ++i) {
            const char * segment = whisper_full_get_segment_text(g_context, i);
            if (segment != nullptr) {
                result += segment;
            }
        }

        return result;
    }));
}
