const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const ADD_STATE_FILE = path.join(process.cwd(), 'data', 'add.json');

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

function normalizeInput(a, b) {
  if (a?.key?.remoteJid) return { message: a, chatId: a.key.remoteJid, args: Array.isArray(b) ? b : [] };
  if (typeof a === 'string') return { message: b?.key ? b : null, chatId: a, args: [] };
  return { message: null, chatId: null, args: [] };
}

function ensureAddFile() {
  try {
    const dir = path.dirname(ADD_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(ADD_STATE_FILE)) fs.writeFileSync(ADD_STATE_FILE, JSON.stringify({}, null, 2));
  } catch {}
}

function readState() {
  try {
    ensureAddFile();
    return JSON.parse(fs.readFileSync(ADD_STATE_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function isAddEnabled(chatId) {
  const data = readState();
  return data[chatId] !== false;
}

function setAddEnabled(chatId, state) {
  const data = readState();
  data[chatId] = !!state;
  try {
    ensureAddFile();
    fs.writeFileSync(ADD_STATE_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function extractNumber(str = '') {
  return String(str).replace(/[^0-9]/g, '');
}

function parseArgs(message, args) {
  const raw = getText(message).trim();
  const first = (raw.split(/\s+/)[0] || 'add').toLowerCase();
  let text = Array.isArray(args) && args.length ? args.join(' ').trim() : '';
  if (!text) text = raw.slice(first.length).trim();
  return text;
}

function TXT(chatId) {
  const lang = getLang(chatId);

  const base = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botNeedAdmin: '❌ Please make the bot an admin first.',
      adminOnly: '❌ This command is for group admins only.',
      help:
        '*ADD MEMBER*\n\n' +
        '• .add <number>\n' +
        '• .add on\n' +
        '• .add off\n' +
        '• .add status\n\n' +
        'Example:\n.add 201234567890',
      enabled: '✅ Adding enabled.',
      disabled: '⛔ Adding disabled.',
      status: (on) => `Adding is currently *${on ? 'ON' : 'OFF'}* in this group.`,
      currentlyOff: '⛔ Adding is disabled in this group.',
      badNumber: '❌ Invalid number.\nExample:\n.add 201234567890',
      added: (n) => `✅ Added @${n}`,
      privacy: (n) => `🔐 @${n} has privacy enabled, invite sent.`,
      failed: '❌ Failed to add member.'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات فقط.',
      botNeedAdmin: '❌ لازم البوت يكون أدمن.',
      adminOnly: '❌ الأمر للأدمن فقط.',
      help:
        '*إضافة عضو*\n\n' +
        '• .add <رقم>\n' +
        '• .add on\n' +
        '• .add off\n' +
        '• .add status\n\n' +
        'مثال:\n.add 201234567890',
      enabled: '✅ تم تفعيل الإضافة.',
      disabled: '⛔ تم إيقاف الإضافة.',
      status: (on) => `الإضافة حاليًا *${on ? 'شغالة' : 'مقفولة'}* في الجروب.`,
      currentlyOff: '⛔ الإضافة مقفولة في الجروب ده.',
      badNumber: '❌ رقم غير صحيح.\nمثال:\n.add 201234567890',
      added: (n) => `✅ تمت إضافة @${n}`,
      privacy: (n) => `🔐 @${n} قافل الخصوصية وتم إرسال رابط.`,
      failed: '❌ فشل إضافة العضو.'
    }
  };

  return base[lang] || base.en;
}

async function addCommand(sock, a, b) {
  const { message, chatId, args } = normalizeInput(a, b);
  if (!chatId) return;

  const T = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {
    if (message?.key) await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, message ? { quoted: message } : undefined);
    return;
  }

  const senderId = message?.key?.participant || message?.key?.remoteJid || chatId;

  const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

  if (!isBotAdmin) {
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.botNeedAdmin }, message ? { quoted: message } : undefined);
    return;
  }

  if (!isSenderAdmin && !message?.key?.fromMe) {
    await safeReact(sock, chatId, message?.key, '🚫');
    await sock.sendMessage(chatId, { text: T.adminOnly }, message ? { quoted: message } : undefined);
    return;
  }

  const text = parseArgs(message, args);
  const lower = (text || '').toLowerCase().trim();

  if (!text) {
    await safeReact(sock, chatId, message?.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.help }, message ? { quoted: message } : undefined);
    return;
  }

  if (['on', 'off', 'status'].includes(lower)) {
    if (lower === 'status') {
      await safeReact(sock, chatId, message?.key, '📊');
      await sock.sendMessage(
        chatId,
        { text: T.status(isAddEnabled(chatId)) },
        message ? { quoted: message } : undefined
      );
      return;
    }

    const enable = lower === 'on';
    setAddEnabled(chatId, enable);

    await safeReact(sock, chatId, message?.key, enable ? '🟢' : '🔴');
    await sock.sendMessage(chatId, { text: enable ? T.enabled : T.disabled }, message ? { quoted: message } : undefined);
    return;
  }

  if (!isAddEnabled(chatId)) {
    await safeReact(sock, chatId, message?.key, '🔴');
    await sock.sendMessage(chatId, { text: T.currentlyOff }, message ? { quoted: message } : undefined);
    return;
  }

  const number = extractNumber(text);
  if (!number || number.length < 10) {
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.badNumber }, message ? { quoted: message } : undefined);
    return;
  }

  const jid = `${number}@s.whatsapp.net`;

  try {
    await safeReact(sock, chatId, message?.key, '➕');

    const res = await sock.groupParticipantsUpdate(chatId, [jid], 'add').catch(() => null);

    const status = res?.[0]?.status || res?.status || null;
    const inviteLike = status === 403 || status === '403';

    if (inviteLike) {
      try {
        const code = await sock.groupInviteCode(chatId);
        const invite = `https://chat.whatsapp.com/${code}`;

        await safeReact(sock, chatId, message?.key, '🔐');
        await sock.sendMessage(
          chatId,
          { text: `${T.privacy(number)}\n${invite}`, mentions: [jid] },
          message ? { quoted: message } : undefined
        );
        return;
      } catch {
        await safeReact(sock, chatId, message?.key, '🔐');
        await sock.sendMessage(
          chatId,
          { text: T.privacy(number), mentions: [jid] },
          message ? { quoted: message } : undefined
        );
        return;
      }
    }

    await safeReact(sock, chatId, message?.key, '👤');
    await sock.sendMessage(
      chatId,
      { text: T.added(number), mentions: [jid] },
      message ? { quoted: message } : undefined
    );
  } catch (e) {
    console.error('[ADD]', e?.message || e);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, message ? { quoted: message } : undefined);
  }
}

module.exports = {
  name: 'add',
  aliases: ['add', 'invite', 'addmember', 'اضافة', 'اضف'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'إضافة عضو للجروب عن طريق الرقم، مع إمكانية تشغيل/إيقاف الإضافة لكل جروب وعرض الحالة.',
    en: 'Adds a member to the group by number, with per-group on/off toggle and status display.'
  },
  emoji: '➕',

  admin: true,
  owner: false,
  showInMenu: true,
  run: addCommand,
  exec: addCommand,
  execute: (sock, message, args) => addCommand(sock, message, args),
  addCommand
};