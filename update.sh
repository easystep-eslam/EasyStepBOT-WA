#!/bin/sh
set -e

echo "⏳ Starting update..."
cd /home/container

# نظف الريبو المؤقت
rm -rf .newrepo 2>/dev/null || true

# اسحب آخر نسخة
git clone --depth=1 https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

# ✅ تحديث بدون حذف أي ملفات موجودة (عشان نتفادى Permission denied)
# ✅ استثناء: data / session / node_modules / modules / assets (خصوصًا assets/kyc)
tar -C .newrepo \
  --exclude="./.git" \
  --exclude="./data" \
  --exclude="./session" \
  --exclude="./node_modules" \
  --exclude="./modules" \
  --exclude="./assets" \
  -cf - . \
| tar -C . \
  --overwrite \
  --no-same-owner \
  -xf -

# تثبيت الاعتمادات
npm install --omit=dev

# نظف المؤقت
rm -rf .newrepo 2>/dev/null || true

echo "✅ Update finished successfully"
