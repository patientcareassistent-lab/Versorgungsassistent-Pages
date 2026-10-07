#
# Versorgungsassistent browser binding for whisper.cpp.
# Uses the upstream whisper.wasm pthread architecture and a self-hosted
# cross-origin-isolation service worker.
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
    -s USE_PTHREADS=1 \
    -s PTHREAD_POOL_SIZE=4 \
    -s PTHREAD_POOL_SIZE_STRICT=0 \
    -s INITIAL_MEMORY=256MB \
    -s MAXIMUM_MEMORY=1000MB \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s FORCE_FILESYSTEM=1 \
    -s SINGLE_FILE=1 \
")
