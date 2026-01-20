const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const DATA_PATH = path.join(process.cwd(), 'data', 'chatbot.json');

function ensureDataFile() {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2), 'utf8');
  } catch {}
}

function loadData() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_PATH, 'utf8') || '{}';
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveData(data) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_PATH, JSON.stringify(data && typeof data === 'object' ? data : {}, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      adminOnly: '❌ This command is for group admins only.',
      usage:
        '*CHATBOT SETUP*\n\n' +
        '• .chatbot on\n' +
        '• .chatbot off\n' +
        '• .chatbot status',
      enabled: '✅ Chatbot enabled for this group.',
      disabled: '🛑 Chatbot disabled for this group.',
      alreadyOn: 'ℹ️ Chatbot is already enabled.',
      alreadyOff: 'ℹ️ Chatbot is already disabled.',
      status: (on) => `ℹ️ Chatbot status: *${on ? 'ON' : 'OFF'}*`,
      apiFail: '❌ Failed to get a response from the chatbot service.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      adminOnly: '❌ الأمر ده لمشرفين الجروب فقط.',
      usage:
        '*إعداد الشات بوت*\n\n' +
        '• .chatbot on\n' +
        '• .chatbot off\n' +
        '• .chatbot status',
      enabled: '✅ تم تشغيل الشات بوت في الجروب.',
      disabled: '🛑 تم إيقاف الشات بوت في الجروب.',
      alreadyOn: 'ℹ️ الشات بوت شغال بالفعل.',
      alreadyOff: 'ℹ️ الشات بوت مقفول بالفعل.',
      status: (on) => `ℹ️ حالة الشات بوت: *${on ? 'مفعل' : 'غير مفعل'}*`,
      apiFail: '❌ فشل الحصول على رد من خدمة الشات بوت.'
    }
  };
  return { lang, T: dict[lang] || dict.en };
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

function getBotNumber(sock) {
  try {
    const raw = sock.user?.id || '';
    return String(raw).split('@')[0].split(':')[0];
  } catch {
    return '';
  }
}

function getMentionContext(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  const replied = ctx.participant || '';
  return { mentioned, replied };
}

async function chatbotCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const senderId = message.key.participant || message.key.remoteJid;
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message.key, '🤖');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);
  const isSenderAdmin = !!adminStatus?.isSenderAdmin;

  if (!isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    return;
  }

  const sub = String((Array.isArray(args) && args[0]) || '').trim().toLowerCase();
  const data = loadData();
  const enabled = !!data[chatId];

  if (!sub) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    return;
  }

  if (sub === 'status') {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.status(enabled) }, { quoted: message });
    return;
  }

  if (sub === 'on') {
    if (enabled) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.alreadyOn }, { quoted: message });
      return;
    }
    data[chatId] = true;
    const ok = saveData(data);
    await safeReact(sock, chatId, message.key, ok ? '✅' : '❌');
    await sock.sendMessage(chatId, { text: ok ? T.enabled : T.apiFail }, { quoted: message });
    return;
  }

  if (sub === 'off') {
    if (!enabled) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.alreadyOff }, { quoted: message });
      return;
    }
    delete data[chatId];
    const ok = saveData(data);
    await safeReact(sock, chatId, message.key, ok ? '🛑' : '❌');
    await sock.sendMessage(chatId, { text: ok ? T.disabled : T.apiFail }, { quoted: message });
    return;
  }

  await safeReact(sock, chatId, message.key, 'ℹ️');
  await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
}

async function handleChatbotResponse(sock, chatId, message, senderId, userText) {
  try {
    if (!chatId || !message) return;

    const data = loadData();
    if (!data[chatId]) return;

    if (message.key?.fromMe) return;

    const botNumber = getBotNumber(sock);
    if (!botNumber) return;

    const { mentioned, replied } = getMentionContext(message);
    const isMentioned = mentioned.some((j) => String(j || '').includes(botNumber));
    const isReply = replied && String(replied).includes(botNumber);

    if (!isMentioned && !isReply) return;

    const cleanText = String(userText || '').replace(/@\d+/g, '').trim();
    if (!cleanText) return;

    await safeReact(sock, chatId, message.key, '💬');

    const prompt =
      `Reply like a WhatsApp user.\n` +
      `Short reply (1-2 lines).\n` +
      `Same language as user.\n\n` +
      `User message:\n${cleanText}`;

    const res = await fetch('https://zellapi.autos/ai/chatbot?text=' + encodeURIComponent(prompt));
    if (!res.ok) return;

    const json = await res.json().catch(() => null);
    if (!json?.status || !json?.result) return;

    await sock.sendMessage(chatId, { text: String(json.result) }, { quoted: message });
  } catch (e) {
    console.error('[CHATBOT]', e?.message || e);
  }
}

module.exports = {
  name: 'chatbot',

  aliases: ['chatbot', 'شاتبوت', 'بوت_شات'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'تشغيل/إيقاف الشات بوت داخل الجروب (يرد فقط عند منشن البوت أو الرد عليه).',
    en: 'Enable/disable chatbot in the group (replies only when mentioned or replied to).'
  },

  usage: {
    ar: '.chatbot on | off | status',
    en: '.chatbot on | off | status'
  },

  emoji: '🤖',

  admin: true,
  owner: false,
  showInMenu: true,

  exec: chatbotCommand,
  run: chatbotCommand,
  execute: (sock, message, args) => chatbotCommand(sock, message, args),

  handleChatbotResponse
};