#!/bin/sh
set -e

DATA="${DATA_DIR:-/data}"
mkdir -p "$DATA"

# Seed read-only corridor + contact templates on first boot (Render disk starts empty).
for f in corridors.json corridors.sepolia.json contacts.json; do
  if [ ! -f "$DATA/$f" ] && [ -f "/app/data/$f" ]; then
    cp "/app/data/$f" "$DATA/$f"
  fi
done

exec node dist/server.js
