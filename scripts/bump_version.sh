#!/usr/bin/env bash
# Increment the extension version in metadata.json (assumes numeric version)
set -euo pipefail

# Install jq if not present (Ubuntu environment)
if ! command -v jq >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y jq
fi

CURRENT=$(jq '.version' metadata.json)
NEW=$((CURRENT+1))

# Update the file
jq ".version = $NEW" metadata.json > metadata.tmp && mv metadata.tmp metadata.json

echo "Bumped version: $CURRENT -> $NEW"
