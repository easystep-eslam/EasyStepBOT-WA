#!/bin/sh
set -e

cd /home/container

echo "⏳ Safe update (NO DELETE) ..."

# لازم يكون المشروع متسحب بـ git
if [ ! -d ".git" ]; then
  echo "❌ .git not found. This method needs a git clone project."
  echo "✅ الحل: اسحب المشروع مرة واحدة بـ git clone داخل /home/container"
  exit 1
fi

# هات آخر نسخة من الريبو
git fetch origin main

# ✅ أهم جزء: git archive + tar extract
# ده بيكتب ملفات الكود فوق الموجود فقط، ومش بيعمل حذف لأي حاجة عندك
# وبيستثني data/session/node_modules والملفات الحساسة
git archive --format=tar origin/main | tar -x -C /home/container \
  --exclude='data/*' \
  --exclude='session/*' \
  --exclude='node_modules/*' \
  --exclude='baileys_store.json' \
  --exclude='.env'

# ثبت البكجات
npm install --omit=dev

echo "✅ Done. data/ was NOT deleted."
