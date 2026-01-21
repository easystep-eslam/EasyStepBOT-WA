#!/bin/sh
set -e

echo "⏳ Starting update..."
cd /home/container

rm -rf .newrepo 2>/dev/null || true
git clone --depth=1 https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

rm -rf .backup_update 2>/dev/null || true
mkdir -p .backup_update
cp -r data .backup_update/ 2>/dev/null || true
cp -r session .backup_update/ 2>/dev/null || true
cp -r modules .backup_update/ 2>/dev/null || true
cp baileys_store.json .backup_update/ 2>/dev/null || true

# ✅ تحديث فوق الموجود بدون حذف + استثناء data/session/modules/node_modules/.git
# ✅ + استثناء assets/kyc لتفادي Permission denied نهائيًا
tar -C .newrepo \
  --exclude="./data" \
  --exclude="./session" \
  --exclude="./modules" \
  --exclude="./node_modules" \
  --exclude="./.git" \
  --exclude="./assets/kyc" \
  -cf - . \
| tar -C . --overwrite --no-same-owner -xf -

# رجّع بياناتك
rm -rf data session modules 2>/dev/null || true
cp -r .backup_update/data . 2>/dev/null || true
cp -r .backup_update/session . 2>/dev/null || true
cp -r .backup_update/modules . 2>/dev/null || true
cp .backup_update/baileys_store.json . 2>/dev/null || true

npm install --omit=dev

rm -rf .newrepo .backup_update 2>/dev/null || true
echo "✅ Update finished successfully"
