#!/bin/sh
set -e

echo "⏳ Starting update..."

cd /home/container

NEWREPO=".newrepo"
BACKUP=".backup_update"

REPO_URL="https://github.com/easystep-eslam/EasyStepBOT-WA.git"

# folders/files we MUST keep
KEEP_DIRS="data session modules node_modules"
KEEP_FILES="baileys_store.json"

# تنظيف أي بقايا قديمة
rm -rf "$NEWREPO" "$BACKUP"

# clone
git clone --depth=1 "$REPO_URL" "$NEWREPO"

# Backup المهم (data + session + modules + baileys_store.json)
mkdir -p "$BACKUP"

if [ -d "data" ]; then
  cp -r "data" "$BACKUP/" 2>/dev/null || true
fi

if [ -d "session" ]; then
  cp -r "session" "$BACKUP/" 2>/dev/null || true
fi

if [ -d "modules" ]; then
  cp -r "modules" "$BACKUP/" 2>/dev/null || true
fi

if [ -f "baileys_store.json" ]; then
  cp "baileys_store.json" "$BACKUP/" 2>/dev/null || true
fi

# امسح كل ملفات المشروع الحالية ماعدا الحاجات اللي لازم تتساب
# (ممنوع نقرب لـ data / session / modules / node_modules)
for f in * .*; do
  [ "$f" = "." ] && continue
  [ "$f" = ".." ] && continue

  # لو مش موجود أصلا تخطّى
  [ -e "$f" ] || continue

  case "$f" in
    data|session|modules|node_modules) continue ;;
    baileys_store.json) continue ;;
  esac

  rm -rf "$f"
done

# انسخ محتوى repo الجديد (بدون data/session/modules/node_modules/.git)
cd "$NEWREPO"

for f in * .*; do
  [ "$f" = "." ] && continue
  [ "$f" = ".." ] && continue
  [ -e "$f" ] || continue

  case "$f" in
    data|session|modules|node_modules|.git) continue ;;
  esac

  cp -r "$f" /home/container/
done

cd /home/container

# Restore البيانات
if [ -d "$BACKUP/data" ]; then
  rm -rf "data"
  cp -r "$BACKUP/data" .
fi

if [ -d "$BACKUP/session" ]; then
  rm -rf "session"
  cp -r "$BACKUP/session" .
fi

if [ -d "$BACKUP/modules" ]; then
  rm -rf "modules"
  cp -r "$BACKUP/modules" .
fi

if [ -f "$BACKUP/baileys_store.json" ]; then
  cp "$BACKUP/baileys_store.json" .
fi

# Install deps
npm install --omit=dev

# Cleanup
rm -rf "$NEWREPO" "$BACKUP"

echo "✅ Update finished successfully"
