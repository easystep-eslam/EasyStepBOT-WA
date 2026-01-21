#!/bin/sh
set -e

echo "⏳ Starting update..."

cd /home/container

if [ -d ".newrepo" ]; then
rm -rf .newrepo
fi

git clone https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

احفظ البيانات المهمة

mkdir -p .backup_update
cp -r data .backup_update/ 2>/dev/null || true
cp -r session .backup_update/ 2>/dev/null || true
cp baileys_store.json .backup_update/ 2>/dev/null || true

انسخ كل حاجة ما عدا data و session و node_modules

for item in .newrepo/* .newrepo/.*; do
name=$(basename "$item")
if [ "$name" = "." ] || [ "$name" = ".." ] || \
[ "$name" = "data" ] || [ "$name" = "session" ] || \
[ "$name" = "node_modules" ]; then
continue
fi
rm -rf "$name"
cp -r "$item" .
done

رجّع البيانات

cp -r .backup_update/data . 2>/dev/null || true
cp -r .backup_update/session . 2>/dev/null || true
cp .backup_update/baileys_store.json . 2>/dev/null || true

npm install --omit=dev

rm -rf .newrepo .backup_update

echo "✅ Update finished successfully"

عدل
