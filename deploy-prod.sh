#!/bin/bash
set -e

echo "Deploy Status page"

cd "$(dirname "$0")"

echo "Update"
git fetch origin
git checkout prod
git reset --hard origin/prod

echo "Install deps"
npm install

echo "Clean legacy PM2 processes"
for app in status; do
  pm2 delete "$app" >/dev/null 2>&1 || true
done

echo "PM2 reload"
pm2 start ecosystem.config.js || true
pm2 reload ecosystem.config.js --update-env

echo "Save PM2 state"
pm2 save

echo "Deploy finish"
