const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

const ANTICALL_FILE = path.join(process.cwd(), 'data', 'anticall.json');

function ensureFile() {
  try {
    const dir = path.dirname(ANTICALL_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(ANTICALL_FILE)) {
      fs.writeFileSync(ANTICALL_FILE, JSON.stringify({ enabled: false }, null, 2), 'utf8');
    }
  } catch {}
}

function readState() {
  try {
    ensureFile();
    const raw = fs.readFileSync(ANTICALL_FILE, 'utf8') || '{}';
    const data = JSON.parse(raw);
    return { enabled: !!data.enabled };
  } catch {
    return { enabled: false };
  }
}

function writeState(enabled) {
  try {
    ensureFile();
    fs.writeFileSync(ANTICALL_FILE, JSON.stringify({ enabled: !!enabled }, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
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

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const base = {
    en: {
      help:
        '*ANTICALL*\n\n' +
        '• .anticall on\n' +
        '• .anticall off\n' +
        '• .anticall status',
      status: (on) => `Anticall is currently *${on ? 'ON' : 'OFF'}*.`,
      changed: (on) => `Anticall is now *${on ? 'ENABLED' : 'DISABLED'}*.`,
      saveFail: '❌ Failed to save settings.',
      error: '❌ Error while processing anticall command.'
    },
    ar: {
      help:
        '*منع المكالمات*\n\n' +
        '• .anticall on\n' +
        '• .anticall off\n' +
        '• .anticall status',
      status: (on) => `منع المكالمات حاليًا *${on ? 'مفعل' : 'غير مفعل'}*.`,
      changed: (on) => `تم *${on ? 'تفعيل' : 'إيقاف'}* منع المكالمات.`,
      saveFail: '❌ فشل حفظ الإعدادات.',
      error: '❌ حصل خطأ أثناء تنفيذ أمر منع المكالمات.'
    }
  };
  return { lang, T: base[lang] || base.en };
}

async function anticallCommand(sock, chatId, message, args) {
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message?.key, '📵');

  try {
    let sub = '';
    if (Array.isArray(args) && args.length) sub = String(args[0] || '').trim().toLowerCase();
    else {
      const raw = getText(message).trim();
      const used = (raw.split(/\s+/)[0] || 'anticall').toLowerCase();
      sub = raw.slice(used.length).trim().split(/\s+/)[0]?.toLowerCase() || '';
    }

    const state = readState();

    if (!sub || !['on', 'off', 'status'].includes(sub)) {
      await safeReact(sock, chatId, message?.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
      return;
    }

    if (sub === 'status') {
      await safeReact(sock, chatId, message?.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.status(state.enabled) }, { quoted: message });
      return;
    }

    const enable = sub === 'on';
    const ok = writeState(enable);

    if (!ok) {
      await safeReact(sock, chatId, message?.key, '❌');
      await sock.sendMessage(chatId, { text: T.saveFail }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message?.key, enable ? '✅' : '⛔');
    await sock.sendMessage(chatId, { text: T.changed(enable) }, { quoted: message });
  } catch (e) {
    console.error('[ANTICALL]', e?.message || e);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: TXT(chatId).T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'anticall',
  aliases: ['anticall', 'منع_المكالمات', 'منع_مكالمات'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'منع مكالمات الواتساب: تشغيل/إيقاف ميزة الحظر التلقائي عند استقبال مكالمة.',
    en: 'Anti-call protection: enable/disable auto-block when receiving WhatsApp calls.'
  },

  usage: {
    ar: '.anticall on | off | status',
    en: '.anticall on | off | status'
  },

  emoji: '📵',

  admin: true,
  owner: false,
  showInMenu: true,

  run: anticallCommand,
  exec: anticallCommand,
  execute: anticallCommand,

  readState
};