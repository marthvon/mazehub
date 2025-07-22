#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

DIR="$1"

for file in "$DIR"/*.js; do
  [ -e "$file" ] || continue

  basefile=$(basename "$file")
  if [[ "$basefile" == "utils.js" || "$basefile" == "presets.server.js" ]]; then
    echo "Skipping $file"
    continue
  fi

  if ! grep -q '^"use client";' "$file"; then
    echo "Adding 'use client' to $file"
    tmpfile=$(mktemp)
    printf '"use client";' > "$tmpfile"
    cat "$file" >> "$tmpfile"
    mv "$tmpfile" "$file"
  else
    echo "$file already has 'use client'"
  fi
done
