#!/usr/bin/env bash
# Starts the classroom search services for local development:
# the Java bridge server (room-finder-java) and, unless CPP_SERVER_HOST points to the real
# C++ server, the local C++ stand-in (mock-cpp-room-server). Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="$ROOT/room-finder-java/target/schedule-server-1.0.0.jar"

if [ ! -f "$JAR" ]; then
  echo "Building room-finder-java..."
  (cd "$ROOT/room-finder-java" && mvn -q -B package -DskipTests)
fi

if [ -z "${CPP_SERVER_HOST:-}" ]; then
  node "$ROOT/mock-cpp-room-server/server.mjs" &
  MOCK_PID=$!
  trap 'kill $MOCK_PID 2>/dev/null' EXIT
fi

cd "$ROOT/room-finder-java"
java -jar "$JAR"
