#!/bin/bash
set -e

cd /home/container

rm -rf .newrepo .backup_update .json_list.txt
mkdir -p .backup_update

if [ -d session ]; then
  cp -a session .backup_update/
fi

if [ -d data ]; then
  find data -type f -name '*.json' > .json_list.txt || true
  mkdir -p .backup_update/data_json
  if [ -s .json_list.txt ]; then
    while IFS= read -r f; do
      d=$(dirname "$f")
      mkdir -p .backup_update/data_json/"$d"
      cp -a "$f" .backup_update/data_json/"$f"
    done < .json_list.txt
  fi
fi

git clone --depth 1 -b main https://github.com/easystep-eslam/EasyStepBOT-WA.git .newrepo

find /home/container -mindepth 1 -maxdepth 1 ! -name session ! -name data ! -name node_modules ! -name update.sh ! -name .backup_update ! -name .newrepo -exec rm -rf {} +

rm -rf .newrepo/session .newrepo/data .newrepo/node_modules 2>/dev/null || true
cp -a .newrepo/. .
rm -rf .newrepo

if [ -d .backup_update/session ]; then
  rm -rf session
  cp -a .backup_update/session .
fi

if [ -d .backup_update/data_json ]; then
  find .backup_update/data_json -type f -name '*.json' > .json_list.txt || true
  if [ -s .json_list.txt ]; then
    while IFS= read -r f; do
      rel=${f#.backup_update/data_json/}
      mkdir -p data/$(dirname "$rel")
      cp -a "$f" data/"$rel"
    done < .json_list.txt
  fi
fi

rm -rf .backup_update .json_list.txt

npm install --omit=dev

echo "✅ Update finished successfully."
exit 0
