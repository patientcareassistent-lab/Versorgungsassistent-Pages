#
# Versorgungsassistent browser binding for whisper.cpp.
# Single-thread WASM runs inside a dedicated Web Worker so the UI stays responsive
# without SharedArrayBuffer / COOP / COEP requirements.
#

set(TARGET libmain)

add_executable(${TARGET}
    emscripten.cpp
)

include(DefaultTargetOptions)

target_link_libraries(${TARGET} PRIVATE
    whisper
)

set_target_properties(${TARGET} PROPERTIES LINK_FLAGS " \
    --bind \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='whisper_factory' \
    -s INITIAL_MEMORY=256MB \
    -s MAXIMUM_MEMORY=1000MB \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s FORCE_FILESYSTEM=1 \
    -s SINGLE_FILE=1 \
    -s ENVIRONMENT='worker' \
")
