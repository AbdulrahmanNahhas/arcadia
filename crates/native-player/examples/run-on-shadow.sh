#!/bin/sh
# Run from the repository root, inside devenv; reuse the application compatibility launcher.
set -eu
export GDK_BACKEND="${GDK_BACKEND:-wayland}"
exec bash bin/nahhasio-native-runtime target/debug/examples/gtk_local "$@"
