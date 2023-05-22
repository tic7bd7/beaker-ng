set CFLAGS="-DNDEBUG /O2 /arch:AVX -mavx -maes -O3 -g0 -s -Wno-deprecated-declarations -Wno-implicit-fallthrough -Wno-cast-function-type -Wno-unused-variable"
set CXXFLAGS="-DNDEBUG /O2 /arch:AVX -mavx -maes -O3 -g0 -s -Wno-deprecated-declarations -Wno-implicit-fallthrough -Wno-cast-function-type -Wno-unused-variable"
set CPPFLAGS="-DNDEBUG /O2 /arch:AVX -mavx -maes -O3 -g0 -s -Wno-deprecated-declarations -Wno-implicit-fallthrough -Wno-cast-function-type -Wno-unused-variable"
set LDFLAGS="-Wl,-O3 -mavx -maes -s"
set VERBOSE=1
set V=1

set MSVS_VERSION="2017"
set GYP_MSVS_VERSION="2017"
set ELECTRON_CACHE=%~dp0%electron\bin
set electron_config_cache=%~dp0%electron\bin

npm run burnthemall

rem set NODE_ENV=production

rem npm run dist

rem cd ..

rem python3 -m castlabs_evs.vmp sign-pkg dist\win-unpacked

rem cd ..\scripts

rem npm run dist-win