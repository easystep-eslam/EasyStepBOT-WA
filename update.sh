#!/bin/sh
set -e

echo "⏳ Starting update..."
cd /home/container

# Backup المهم (من غير ما نلمس data/session)
rm -rf .backup_update 2>/dev/null || true
mkdir -p .backup_update
cp -r data .backup_update/ 2>/dev/null || true
cp -r session .backup_update/ 2>/dev/null || true
cp -r modules .backup_update/ 2>/dev/null || true
cp baileys_store.json .backup_update/ 2>/dev/null || true

# ✅ لو المشروع git repo: حدّث الـ HEAD الحقيقي بدل نسخ ملفات بس
if [ -d ".git" ]; then
  git remote set-url origin https://github.com/easystep-eslam/EasyStepBOT-WA.git 2>/dev/null || true
  git fetch origin main
  git reset --hard origin/main
  git clean -fd
else
  # fallback لو مفيش .git (لو منزّل Zip)
  rm -rf .newrepo 2>/dev/null || true
  git clone --depth=1 https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

  rm -f .newrepo.tar 2>/dev/null || true
  tar -C .newrepo --exclude="./.git" --exclude="./node_modules" -cf .newrepo.tar .
  tar -C /home/container --overwrite --no-same-owner -xf .newrepo.tar

  rm -rf .newrepo 2>/dev/null || true
  rm -f .newrepo.tar 2>/dev/null || true
fi

# رجّع الداتا
rm -rf data session modules 2>/dev/null || true
cp -r .backup_update/data . 2>/dev/null || true
cp -r .backup_update/session . 2>/dev/null || true
cp -r .backup_update/modules . 2>/dev/null || true
cp .backup_update/baileys_store.json . 2>/dev/null || true

npm install --omit=dev

rm -rf .backup_update 2>/dev/null || true

echo "✅ Update finished successfully"
