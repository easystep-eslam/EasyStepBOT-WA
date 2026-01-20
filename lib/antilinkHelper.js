const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'antilinkSettings.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2), 'utf8');
}

function loadSettings() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function saveSettings(data) {
  ensureFile();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * @param {string} groupId
 * @param {'off'|'delete'|'warn'|'kick'} action
 */
function setAntilinkSetting(groupId, action) {
  const data = loadSettings();
  data[groupId] = action;
  saveSettings(data);
}

/**
 * @param {string} groupId
 * @returns {'off'|'delete'|'warn'|'kick'}
 */
function getAntilinkSetting(groupId) {
  const data = loadSettings();
  return data[groupId] || 'off';
}

module.exports = {
  setAntilinkSetting,
  getAntilinkSetting
};