#!/bin/sh
set -e

echo "⏳ Starting update..."
cd /home/container

# نظّف الريبو المؤقت فقط (مسموح)
rm -rf .newrepo 2>/dev/null || true

# اسحب آخر نسخة من GitHub
git clone --depth=1 https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

# ✅ تحديث “فوق الموجود” بدون مسح أي ملفات قديمة إطلاقًا
# ✅ نستثني data/session/modules/node_modules/.git
# ✅ (اختياري) نستثني assets/kyc لأن ده مصدر Permission denied عندك
tar -C .newrepo \
  --exclude="./data" \
  --exclude="./session" \
  --exclude="./modules" \
  --exclude="./node_modules" \
  --exclude="./.git" \
  --exclude="./assets/kyc" \
  -cf - . \
| tar -C . --overwrite --no-same-owner -xf -

# تثبيت Dependencies
npm install --omit=dev

# تنظيف المؤقت فقط
rm -rf .newrepo 2>/dev/null || true

echo "✅ Update finished successfully"
