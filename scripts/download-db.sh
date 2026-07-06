#!/usr/bin/env bash
# Downloads the latest trivia questions database from the private release repo.
# Requires the GitHub CLI (gh) to be installed and authenticated.
#
# Usage: ./scripts/download-db.sh
# Or with a specific tag: RELEASE_TAG=v1.2 ./scripts/download-db.sh

set -euo pipefail

REPO="Mookiies/cirquiz-questions"
TAG="${RELEASE_TAG:-latest}"
DEST="apps/cirquiz/assets/trivia.db"

echo "Downloading trivia.db from ${REPO} (${TAG})…"
gh release download "${TAG}" \
  --repo "${REPO}" \
  --pattern "trivia.db" \
  --output "${DEST}" \
  --clobber

echo "Done → ${DEST}"
