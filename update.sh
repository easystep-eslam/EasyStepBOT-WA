#!/bin/sh
set -e

cd /home/container

echo "⏳ Updating code (keeping data/) ..."

# لو الريبو موجود (.git موجود) نحدّث الكود فقط
if [ -d ".git" ]; then
  git fetch origin main

  # ✅ احمي فولدرات وملفات الداتا من أي reset/clean
  git reset --hard origin/main

  # امسح ملفات الكود غير المتتبعة فقط، واستثني data/session وكل ملفات التشغيل
  git clean -fd \
    -e data/ \
    -e session/ \
    -e baileys_store.json \
    -e node_modules/

else
  echo "❌ This folder is not a git repo (.git not found)."
  echo "✅ الحل: نزّل البوت كـ Git Clone مرة واحدة بدل Zip عشان التحديث يبقى آمن."
  exit 1
fi

# تثبيت الاعتمادات بدون لمس الداتا
npm install --omit=dev

echo "✅ Update done. data/ untouched."
