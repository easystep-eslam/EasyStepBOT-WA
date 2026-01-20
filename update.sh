#!/bin/bash
set -e

APP_DIR="/home/container"
REPO_URL="https://github.com/easystep-eslam/EasyStepBOT-WA.git"
BRANCH="main"

cd "$APP_DIR"

rm -rf "$APP_DIR/.backup_update"
mkdir -p "$APP_DIR/.backup_update"

# Backup session
if [ -d "$APP_DIR/session" ]; then
  cp -a "$APP_DIR/session" "$APP_DIR/.backup_update/"
fi

# Backup data JSON only
mkdir -p "$APP_DIR/.backup_update/data_json"
if [ -d "$APP_DIR/data" ]; then
  find "$APP_DIR/data" -type f -name "*.json" -print0 | while IFS= read -r -d '' f; do
    rel="${f#$APP_DIR/data/}"
    mkdir -p "$APP_DIR/.backup_update/data_json/$(dirname "$rel")"
    cp -a "$f" "$APP_DIR/.backup_update/data_json/$rel"
  done
fi

# Remove old tracked/untracked project files (keep session, data, node_modules, update.sh, backup)
rm -rf "$APP_DIR/.git" "$APP_DIR/.gitignore" "$APP_DIR/.github" 2>/dev/null || true
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name "session" ! -name "data" ! -name "node_modules" ! -name "update.sh" ! -name ".backup_update" -exec rm -rf {} +

# Fresh clone
rm -rf "$APP_DIR/.newrepo"
git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$APP_DIR/.newrepo"

# Copy new repo into place (excluding session/data/node_modules)
rm -rf "$APP_DIR/.newrepo/session" "$APP_DIR/.newrepo/data" "$APP_DIR/.newrepo/node_modules" 2>/dev/null || true
cp -a "$APP_DIR/.newrepo/." "$APP_DIR/"
rm -rf "$APP_DIR/.newrepo"

# Update data folder from repo then restore JSON
rm -rf "$APP_DIR/.tmp_data"
git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$APP_DIR/.tmp_data"
if [ -d "$APP_DIR/.tmp_data/data" ]; then
  rm -rf "$APP_DIR/data"
  cp -a "$APP_DIR/.tmp_data/data" "$APP_DIR/data"
fi
rm -rf "$APP_DIR/.tmp_data"

# Restore session
if [ -d "$APP_DIR/.backup_update/session" ]; then
  rm -rf "$APP_DIR/session"
  cp -a "$APP_DIR/.backup_update/session" "$APP_DIR/"
fi

# Restore JSON files into data
if [ -d "$APP_DIR/.backup_update/data_json" ]; then
  find "$APP_DIR/.backup_update/data_json" -type f -name "*.json" -print0 | while IFS= read -r -d '' f; do
    rel="${f#$APP_DIR/.backup_update/data_json/}"
    mkdir -p "$APP_DIR/data/$(dirname "$rel")"
    cp -a "$f" "$APP_DIR/data/$rel"
  done
fi

rm -rf "$APP_DIR/.backup_update"

echo "✅ Update finished."
exit 0