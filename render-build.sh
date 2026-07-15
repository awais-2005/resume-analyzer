#!/usr/bin/env bash
set -o errexit

npm install
npm run build

# Persist the Puppeteer Chrome cache across the build/runtime split
if [[ ! -d $PUPPETEER_CACHE_DIR ]]; then
  echo "...Copying Puppeteer Cache from Build Cache"
  mkdir -p "$PUPPETEER_CACHE_DIR"
  cp -R /opt/render/project/src/.cache/puppeteer/. "$PUPPETEER_CACHE_DIR/" 2>/dev/null || true
else
  echo "...Storing Puppeteer Cache in Build Cache"
  mkdir -p /opt/render/project/src/.cache/puppeteer
  cp -R "$PUPPETEER_CACHE_DIR/." /opt/render/project/src/.cache/puppeteer/
fi
