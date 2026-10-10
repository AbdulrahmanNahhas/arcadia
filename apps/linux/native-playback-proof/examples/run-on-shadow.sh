#!/bin/sh
# Diagnostic-only compatibility launcher for Shadow's newer host graphics ABI.
# Run from the repository root, inside devenv. No config/global env changes.
set -eu
loader=$(readelf -l /run/current-system/sw/bin/niri |
  sed -n 's/.*Requesting program interpreter: \(.*\)]/\1/p')
if [ -z "$loader" ] || [ ! -x "$loader" ]; then
  echo "Cannot identify Shadow's host ELF loader" >&2
  exit 1
fi
export GDK_BACKEND="${GDK_BACKEND:-wayland}"
exec "$loader" \
  --library-path "$(dirname "$loader")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
  target/debug/examples/gtk_local "$@"
