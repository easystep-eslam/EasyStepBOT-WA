const fs = require('fs');
const path = require('path');
const { getLang } = require('../lib/lang');

// List of emojis for command reactions
const commandEmojis = ['⏳'];

// Path for storing auto-reaction state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

function ensureUserGroupDataFile() {
  const dir = path.dirname(USER_GROUP_DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(USER_GROUP_DATA)) {
    const defaultData = {
      antibadword: {},
      antilink: {},
      antitag: {},
      welcome: {},
      goodbye: {},
      chatbot: {},
      warnings: {},
      sudo: [],
      autoReaction: false
    };
    fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(defaultData, null, 2));
  }
}

function readUserGroupData() {
  ensureUserGroupDataFile();
  try {
    return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
  } catch (e) {
    console.error('Error reading userGroupData.json:', e);
    return {
      antibadword: {},
      antilink: {},
      antitag: {},
      welcome: {},
      goodbye: {},
      chatbot: {},
      warnings: {},
      sudo: [],
      autoReaction: false
    };
  }
}

function writeUserGroupData(data) {
  try {
    fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Error writing userGroupData.json:', e);
    return false;
  }
}

// Load auto-reaction state from file
function loadAutoReactionState() {
  try {
    const data = readUserGroupData();
    return !!data.autoReaction;
  } catch (error) {
    console.error('Error loading auto-reaction state:', error);
    return false;
  }
}

// Save auto-reaction state to file
function saveAutoReactionState(state) {
  try {
    const data = readUserGroupData();
    data.autoReaction = !!state;
    writeUserGroupData(data);
  } catch (error) {
    console.error('Error saving auto-reaction state:', error);
  }
}

// Store auto-reaction state
let isAutoReactionEnabled = loadAutoReactionState();

function getRandomEmoji() {
  return commandEmojis[0];
}

// Function to add reaction to a command message
async function addCommandReaction(sock, message) {
  try {
    if (!isAutoReactionEnabled || !message?.key?.id) return;

    const emoji = getRandomEmoji();
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch (error) {
    console.error('Error adding command reaction:', error);
  }
}

function getTextFromMessage(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  );
}

// Function to handle areact command (OWNER ONLY)
async function handleAreactCommand(sock, chatId, message, isOwner) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      onlyOwner: '❌ This command is only available for the owner!',
      on: '✅ Auto-reactions have been enabled globally.',
      off: '✅ Auto-reactions have been disabled globally.',
      status: (state) =>
        `Auto-reactions are currently *${state}* globally.\n\nUse:\n.areact on\n.areact off`,
      error: '❌ Error controlling auto-reactions.'
    },
    ar: {
      onlyOwner: '❌ الأمر ده للمالك (Owner) فقط!',
      on: '✅ تم تشغيل الريأكت التلقائي عالميًا.',
      off: '✅ تم إيقاف الريأكت التلقائي عالميًا.',
      status: (state) =>
        `الريأكت التلقائي حاليًا: *${state}* (عالميًا)\n\nالاستخدام:\n.areact on\n.areact off`,
      error: '❌ حصل خطأ أثناء التحكم في الريأكت التلقائي.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    if (!isOwner) {
      await sock.sendMessage(chatId, { text: T.onlyOwner }, { quoted: message });
      return;
    }

    const text = getTextFromMessage(message).trim();
    const parts = text.split(/\s+/);
    const action = (parts[1] || '').toLowerCase();

    if (action === 'on') {
      isAutoReactionEnabled = true;
      saveAutoReactionState(true);
      await sock.sendMessage(chatId, { text: T.on }, { quoted: message });
      return;
    }

    if (action === 'off') {
      isAutoReactionEnabled = false;
      saveAutoReactionState(false);
      await sock.sendMessage(chatId, { text: T.off }, { quoted: message });
      return;
    }

    const currentState = isAutoReactionEnabled ? (lang === 'ar' ? 'شغال' : 'enabled') : (lang === 'ar' ? 'مقفول' : 'disabled');
    await sock.sendMessage(chatId, { text: T.status(currentState) }, { quoted: message });
  } catch (error) {
    console.error('Error handling areact command:', error);
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  addCommandReaction,
  handleAreactCommand,

  // ✅ عشان يبقى متوافق مع نظام الأوامر الجديد لو بتحب تستخدمه كـ command module
  // (لو مش محتاجه، سيبه عادي مش هيأثر)
  name: 'areact',
  aliases: ['autoreact', 'react'],
  category: { ar: '⚙️ إعدادات', en: '⚙️ Settings' },
  description: { ar: 'تشغيل/إيقاف الريأكت التلقائي على الأوامر (عالميًا).', en: 'Enable/disable auto reactions for commands (globally).' },
  usage: { ar: '.areact on | off', en: '.areact on | off' },
  admin: false,
  owner: true,
  showInMenu: true
};