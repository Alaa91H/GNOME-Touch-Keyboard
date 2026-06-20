#!/usr/bin/env bash
# Publish the built zip as a GitHub Release.
# This script is intended to be run in the GitHub Actions environment.
# It expects the following environment variables (provided by GitHub Actions):
#   GITHUB_TOKEN   – automatically provided secret token for authentication.
#   TAG_NAME       – the tag that triggered the release (e.g., v1.0.0).
#   ZIP_PATH       – path to the built zip file (default: gnome-touch-keyboard@alaa91h.github.io.zip).

set -euo pipefail

# Verify required variables
if [[ -z "${TAG_NAME:-}" ]]; then echo "Error: TAG_NAME not set"; exit 1; fi
ZIP_PATH="${ZIP_PATH:-gnome-touch-keyboard@alaa91h.github.io.zip}"

# Ensure the zip exists
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Error: zip file $ZIP_PATH not found"
  exit 1
fi

# Create a release (draft false, prerelease false)
gh release create "$TAG_NAME" "$ZIP_PATH" \
  --title "Release $TAG_NAME" \
  --notes "Automated release of GNOME Touch Keyboard extension." \
  --repo "$GITHUB_REPOSITORY"

echo "Release $TAG_NAME created with asset $ZIP_PATH"
