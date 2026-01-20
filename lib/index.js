const fs = require('fs');

const path = require('path');

const { getLang } = require('./lang');

const DATA_PATH = path.join(__dirname, '..', 'data', 'userGroupData.json');

function defaultData() {

  return {

    antibadword: {},

    antilink: {},

    antitag: {},

    welcome: {},

    goodbye: {},

    chatbot: {},

    warnings: {},

    sudo: []

  };

}

function ensureDataFile() {

  try {

    const dir = path.dirname(DATA_PATH);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(DATA_PATH)) {

      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData(), null, 2), 'utf8');

    }

  } catch {}

}

function loadUserGroupData() {

  try {

    ensureDataFile();

    const raw = fs.readFileSync(DATA_PATH, 'utf8') || '';

    const parsed = JSON.parse(raw || '{}');

    return parsed && typeof parsed === 'object' ? { ...defaultData(), ...parsed } : defaultData();

  } catch (error) {

    console.error('Error loading user group data:', error);

    return defaultData();

  }

}

function saveUserGroupData(data) {

  try {

    ensureDataFile();

    fs.writeFileSync(DATA_PATH, JSON.stringify(data || defaultData(), null, 2), 'utf8');

    return true;

  } catch (error) {

    console.error('Error saving user group data:', error);

    return false;

  }

}

function getOrCreateMap(data, key) {

  if (!data[key] || typeof data[key] !== 'object') data[key] = {};

  return data[key];

}

function getDefaultWelcomeMessage(jid) {

  const lang = getLang(jid);

  return lang === 'ar'

    ? `👋 أهلاً {user}\nنورت جروب *{group}*.\n\n📌 وصف الجروب:\n{description}`

    : `👋 Welcome {user}\nYou are now in *{group}*.\n\n📌 Group description:\n{description}`;

}

function getDefaultGoodbyeMessage(jid) {

  const lang = getLang(jid);

  return lang === 'ar'

    ? `👋 وداعًا {user}\nشكرًا لتواجدك معنا.`

    : `👋 Goodbye {user}\nThank you for being with us.`;

}

/* ===================== AntiLink ===================== */

async function setAntilink(groupId, type, action) {

  try {

    const data = loadUserGroupData();

    const antilink = getOrCreateMap(data, 'antilink');

    antilink[groupId] = {

      enabled: type === 'on',

      action: action || 'delete'

    };

    saveUserGroupData(data);

    return true;

  } catch (error) {

    console.error('Error setting antilink:', error);

    return false;

  }

}

async function getAntilink(groupId, type) {

  try {

    const data = loadUserGroupData();

    const cfg = data.antilink?.[groupId] || null;

    return type === 'on' ? cfg : null;

  } catch (error) {

    console.error('Error getting antilink:', error);

    return null;

  }

}

async function removeAntilink(groupId) {

  try {

    const data = loadUserGroupData();

    if (data.antilink?.[groupId]) {

      delete data.antilink[groupId];

      saveUserGroupData(data);

    }

    return true;

  } catch (error) {

    console.error('Error removing antilink:', error);

    return false;

  }

}

/* ===================== AntiTag ===================== */

async function setAntitag(groupId, type, action = 'delete') {

  try {

    const data = loadUserGroupData();

    const antitag = getOrCreateMap(data, 'antitag');

    antitag[groupId] = {

      enabled: type === 'on',

      action

    };

    saveUserGroupData(data);

    return true;

  } catch (error) {

    console.error('Error setting antitag:', error);

    return false;

  }

}

async function getAntitag(groupId, type) {

  try {

    const data = loadUserGroupData();

    const cfg = data.antitag?.[groupId] || null;

    return type === 'on' ? cfg : null;

  } catch (error) {

    console.error('Error getting antitag:', error);

    return null;

  }

}

async function removeAntitag(groupId) {

  try {

    const data = loadUserGroupData();

    if (data.antitag?.[groupId]) {

      delete data.antitag[groupId];

      saveUserGroupData(data);

    }

    return true;

  } catch (error) {

    console.error('Error removing antitag:', error);

    return false;

  }

}

/* ===================== Warnings ===================== */

async function incrementWarningCount(groupId, userId) {

  try {

    const data = loadUserGroupData();

    const warnings = getOrCreateMap(data, 'warnings');

    if (!warnings[groupId]) warnings[groupId] = {};

    warnings[groupId][userId] = (warnings[groupId][userId] || 0) + 1;

    saveUserGroupData(data);

    return warnings[groupId][userId];

  } catch (error) {

    console.error('Error incrementing warning count:', error);

    return 0;

  }

}

async function resetWarningCount(groupId, userId) {

  try {

    const data = loadUserGroupData();

    if (data.warnings?.[groupId]?.[userId] != null) {

      data.warnings[groupId][userId] = 0;

      saveUserGroupData(data);

    }

    return true;

  } catch (error) {

    console.error('Error resetting warning count:', error);

    return false;

  }

}

/* ===================== Sudo ===================== */

async function isSudo(userId) {

  try {

    const data = loadUserGroupData();

    return Array.isArray(data.sudo) ? data.sudo.includes(userId) : false;

  } catch {

    return false;

  }

}

async function addSudo(userJid) {

  try {

    const data = loadUserGroupData();

    if (!Array.isArray(data.sudo)) data.sudo = [];

    if (!data.sudo.includes(userJid)) {

      data.sudo.push(userJid);

      saveUserGroupData(data);

    }

    return true;

  } catch {

    return false;

  }

}

async function removeSudo(userJid) {

  try {

    const data = loadUserGroupData();

    data.sudo = (Array.isArray(data.sudo) ? data.sudo : []).filter(u => u !== userJid);

    saveUserGroupData(data);

    return true;

  } catch {

    return false;

  }

}

async function getSudoList() {

  try {

    const data = loadUserGroupData();

    return Array.isArray(data.sudo) ? data.sudo : [];

  } catch {

    return [];

  }

}

/* ===================== Welcome / Goodbye ===================== */

async function addWelcome(jid, enabled, message) {

  try {

    const data = loadUserGroupData();

    const welcome = getOrCreateMap(data, 'welcome');

    const msg = String(message || '').trim() || getDefaultWelcomeMessage(jid);

    welcome[jid] = { enabled: !!enabled, message: msg };

    saveUserGroupData(data);

    return true;

  } catch (error) {

    console.error('Error in addWelcome:', error);

    return false;

  }

}

async function delWelcome(jid) {

  try {

    const data = loadUserGroupData();

    if (data.welcome?.[jid]) {

      delete data.welcome[jid];

      saveUserGroupData(data);

    }

    return true;

  } catch {

    return false;

  }

}

async function isWelcomeOn(jid) {

  try {

    const data = loadUserGroupData();

    return !!data.welcome?.[jid]?.enabled;

  } catch {

    return false;

  }

}

async function getWelcome(jid) {

  try {

    const data = loadUserGroupData();

    return data.welcome?.[jid]?.message || null;

  } catch {

    return null;

  }

}

async function addGoodbye(jid, enabled, message) {

  try {

    const data = loadUserGroupData();

    const goodbye = getOrCreateMap(data, 'goodbye');

    const msg = String(message || '').trim() || getDefaultGoodbyeMessage(jid);

    goodbye[jid] = { enabled: !!enabled, message: msg };

    saveUserGroupData(data);

    return true;

  } catch (error) {

    console.error('Error in addGoodbye:', error);

    return false;

  }

}

async function delGoodBye(jid) {

  try {

    const data = loadUserGroupData();

    if (data.goodbye?.[jid]) {

      delete data.goodbye[jid];

      saveUserGroupData(data);

    }

    return true;

  } catch {

    return false;

  }

}

async function isGoodByeOn(jid) {

  try {

    const data = loadUserGroupData();

    return !!data.goodbye?.[jid]?.enabled;

  } catch {

    return false;

  }

}

async function getGoodbye(jid) {

  try {

    const data = loadUserGroupData();

    return data.goodbye?.[jid]?.message || null;

  } catch {

    return null;

  }

}

/* ===================== AntiBadword ===================== */

async function setAntiBadword(groupId, type, action) {

  try {

    const data = loadUserGroupData();

    const antibadword = getOrCreateMap(data, 'antibadword');

    antibadword[groupId] = {

      enabled: type === 'on',

      action: action || 'delete'

    };

    saveUserGroupData(data);

    return true;

  } catch {

    return false;

  }

}

async function getAntiBadword(groupId, type) {

  try {

    const data = loadUserGroupData();

    const cfg = data.antibadword?.[groupId] || null;

    return type === 'on' ? cfg : null;

  } catch {

    return null;

  }

}

async function removeAntiBadword(groupId) {

  try {

    const data = loadUserGroupData();

    if (data.antibadword?.[groupId]) {

      delete data.antibadword[groupId];

      saveUserGroupData(data);

    }

    return true;

  } catch {

    return false;

  }

}

/* ===================== Chatbot ===================== */

async function setChatbot(groupId, enabled) {

  try {

    const data = loadUserGroupData();

    const chatbot = getOrCreateMap(data, 'chatbot');

    chatbot[groupId] = { enabled: !!enabled };

    saveUserGroupData(data);

    return true;

  } catch {

    return false;

  }

}

async function getChatbot(groupId) {

  try {

    const data = loadUserGroupData();

    return data.chatbot?.[groupId] || null;

  } catch {

    return null;

  }

}

async function removeChatbot(groupId) {

  try {

    const data = loadUserGroupData();

    if (data.chatbot?.[groupId]) {

      delete data.chatbot[groupId];

      saveUserGroupData(data);

    }

    return true;

  } catch {

    return false;

  }

}

module.exports = {

  setAntilink,

  getAntilink,

  removeAntilink,

  setAntitag,

  getAntitag,

  removeAntitag,

  incrementWarningCount,

  resetWarningCount,

  isSudo,

  addSudo,

  removeSudo,

  getSudoList,

  addWelcome,

  delWelcome,

  isWelcomeOn,

  getWelcome,

  addGoodbye,

  delGoodBye,

  isGoodByeOn,

  getGoodbye,

  setAntiBadword,

  getAntiBadword,

  removeAntiBadword,

  setChatbot,

  getChatbot,

  removeChatbot

};