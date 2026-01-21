#!/bin/sh
set -e

echo "⏳ Starting update..."
cd /home/container

rm -rf .newrepo 2>/dev/null || true
git clone --depth=1 https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

# Backup المهم (من غير ما نلمس data/session)
rm -rf .backup_update 2>/dev/null || true
mkdir -p .backup_update
cp -r data .backup_update/ 2>/dev/null || true
cp -r session .backup_update/ 2>/dev/null || true
cp -r modules .backup_update/ 2>/dev/null || true
cp baileys_store.json .backup_update/ 2>/dev/null || true

# ✅ اعمل أرشيف داخل ملف ثم فكّه (بدون pipe)
rm -f .newrepo.tar 2>/dev/null || true

tar -C .newrepo \
  --exclude="./.git" \
  --exclude="./data" \
  --exclude="./session" \
  --exclude="./modules" \
  --exclude="./node_modules" \
  --exclude="./assets" \
  -cf .newrepo.tar .

tar -C /home/container \
  --overwrite \
  --no-same-owner \
  -xf .newrepo.tar

# رجّع الداتا
rm -rf data session modules 2>/dev/null || true
cp -r .backup_update/data . 2>/dev/null || true
cp -r .backup_update/session . 2>/dev/null || true
cp -r .backup_update/modules . 2>/dev/null || true
cp .backup_update/baileys_store.json . 2>/dev/null || true

npm install --omit=dev

rm -rf .newrepo .backup_update 2>/dev/null || true
rm -f .newrepo.tar 2>/dev/null || true

echo "✅ Update finished successfully"
