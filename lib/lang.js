// lib/lang.js
const fs = require('fs');
const path = require('path');

const LANG_FILE = path.join(process.cwd(), 'data', 'groupLang.json');

function ensureFile() {
  const dir = path.dirname(LANG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LANG_FILE)) {
    fs.writeFileSync(LANG_FILE, JSON.stringify({ default: "en", groups: {} }, null, 2));
  }
}

function readData() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(LANG_FILE, 'utf-8'));
  } catch {
    return { default: "en", groups: {} };
  }
}

function getLang(chatId) {
  const data = readData();
  return (data.groups && data.groups[chatId]) || data.default || "en";
}

function setLang(chatId, lang) {
  const data = readData();
  if (!data.groups) data.groups = {};
  data.groups[chatId] = lang;
  fs.writeFileSync(LANG_FILE, JSON.stringify(data, null, 2));
}

module.exports = { getLang, setLang };
