const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

const PMBLOCKER_PATH = path.join(process.cwd(), 'data', 'pmblocker.json');
const PMBLOCKER_SENT_PATH = path.join(process.cwd(), 'data', 'pmblocker_sent.json');

const DEFAULT_PM_BLOCK_MSG =
  '🚫 تنبيه: هذا الحساب مخصص للبوت داخل الجروبات فقط.\n' +
  'برجاء التواصل مع الأدمن المذكور في المنشور الأساسي داخل الجروب.\n' +
  '⚠️ سيتم حظر الرسائل الخاصة تلقائيًا.\n\n' +
  '🚫 Notice: This account is dedicated to the bot in group chats only.\n' +
  'Please contact the admin mentioned in the original group post.\n' +
  '⚠️ Private messages will be blocked automatically.';

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TT(chatId) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      ownerOnly: '❌ Owner/Sudo only.',
      help:
        `📌 Usage:\n` +
        `pmblocker on  - enable DM blocking\n` +
        `pmblocker off - disable DM blocking\n` +
        `pmblocker status - show status\n` +
        `pmblocker setmsg <message> - set warning message (sent in private)`,
      status: (on, msg) =>
        `🔒 PM Blocker: *${on ? 'ON' : 'OFF'}*\n\n📝 Message (sent in private):\n${msg}`,
      setMsgUsage: '📌 Usage: pmblocker setmsg <message>',
      msgUpdated: '✅ PM blocker message updated.',
      enabled: '✅ PM blocker enabled.',
      disabled: '❌ PM blocker disabled.'
    },
    ar: {
      ownerOnly: '❌ الأمر ده للأونر/سودو بس.',
      help:
        `📌 الاستخدام:\n` +
        `pmblocker on  - تفعيل حظر الخاص\n` +
        `pmblocker off - إيقاف حظر الخاص\n` +
        `pmblocker status - عرض الحالة\n` +
        `pmblocker setmsg <رسالة> - تغيير رسالة التحذير (اللي بتتبعت في الخاص)`,
      status: (on, msg) =>
        `🔒 حظر الخاص: *${on ? 'ON' : 'OFF'}*\n\n📝 الرسالة (بتتبعت في الخاص):\n${msg}`,
      setMsgUsage: '📌 الاستخدام: pmblocker setmsg <رسالة>',
      msgUpdated: '✅ تم تحديث رسالة حظر الخاص.',
      enabled: '✅ تم تفعيل حظر الخاص.',
      disabled: '❌ تم إيقاف حظر الخاص.'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

function normalizeJid(jid = '') {
  return String(jid).split(':')[0];
}

function readState() {
  try {
    if (!fs.existsSync(PMBLOCKER_PATH)) {
      return { enabled: false, message: DEFAULT_PM_BLOCK_MSG };
    }
    const raw = fs.readFileSync(PMBLOCKER_PATH, 'utf8');
    const data = JSON.parse(raw || '{}') || {};
    return {
      enabled: !!data.enabled,
      message: (typeof data.message === 'string' && data.message.trim())
        ? data.message.trim()
        : DEFAULT_PM_BLOCK_MSG
    };
  } catch {
    return { enabled: false, message: DEFAULT_PM_BLOCK_MSG };
  }
}

function writeState(enabled, message) {
  try {
    const dir = path.dirname(PMBLOCKER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const current = readState();
    const payload = {
      enabled: !!enabled,
      message: (typeof message === 'string' && message.trim())
        ? message.trim()
        : (current.message || DEFAULT_PM_BLOCK_MSG)
    };
    fs.writeFileSync(PMBLOCKER_PATH, JSON.stringify(payload, null, 2));
  } catch {}
}

/* =========================
   منع تكرار رسالة الخاص (حتى بعد Restart)
   ========================= */
function readSentMap() {
  try {
    if (!fs.existsSync(PMBLOCKER_SENT_PATH)) return {};
    const raw = fs.readFileSync(PMBLOCKER_SENT_PATH, 'utf8');
    const data = JSON.parse(raw || '{}') || {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeSentMap(map) {
  try {
    const dir = path.dirname(PMBLOCKER_SENT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PMBLOCKER_SENT_PATH, JSON.stringify(map || {}, null, 2));
  } catch {}
}

function wasSentBefore(senderJid) {
  const s = normalizeJid(senderJid);
  if (!s) return false;
  const map = readSentMap();
  return !!map[s];
}

function markSent(senderJid) {
  const s = normalizeJid(senderJid);
  if (!s) return;
  const map = readSentMap();
  map[s] = Date.now();
  writeSentMap(map);
}

/* =========================
   ✅ Handler للخاص: رسالة واحدة (AR+EN) ثم Block
   ========================= */
async function handleIncomingDM(sock, message) {
  try {
    const chatId = message?.key?.remoteJid;
    if (!chatId) return false;

    // تجاهل رسائل البوت نفسه
    if (message?.key?.fromMe) return false;

    // الخاص فقط
    if (chatId.endsWith('@g.us')) return false;

    const state = readState();
    if (!state.enabled) return false;

    const senderJid = normalizeJid(message?.key?.participant || message?.key?.remoteJid);
    if (!senderJid) return false;

    // لو Owner/Sudo، سيبه (اختياري)
    const okOwner = await isOwnerOrSudo(senderJid, sock, chatId).catch(() => false);
    if (okOwner) return false;

    // رسالة واحدة فقط لكل رقم
    if (wasSentBefore(senderJid)) return true;
    markSent(senderJid);

    // ابعت الرسالة (بدون quoted)
    await sock.sendMessage(chatId, { text: state.message }).catch(() => {});

    // اعمل Block بعد لحظة عشان الرسالة توصل
    setTimeout(async () => {
      try {
        await sock.updateBlockStatus(senderJid, 'block');
      } catch {}
    }, 800);

    return true;
  } catch {
    return false;
  }
}

function parseArgsFromText(message) {
  const rawText =
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    '';

  const parts = String(rawText || '').trim().split(/\s+/);
  return parts.slice(1);
}

async function pmblockerCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const { T } = TT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '🚫');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const okOwner = message.key.fromMe || (await isOwnerOrSudo(senderId, sock, chatId));

    if (!okOwner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    let list = Array.isArray(args) ? args : [];
    if (!list.length) list = parseArgsFromText(message);

    const sub = String(list[0] || '').toLowerCase();
    const rest = list.slice(1).join(' ').trim();

    const state = readState();

    if (!sub || !['on', 'off', 'status', 'setmsg'].includes(sub)) {
      await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
      return;
    }

    if (sub === 'status') {
      await sock.sendMessage(chatId, { text: T.status(state.enabled, state.message) }, { quoted: message });
      return;
    }

    if (sub === 'setmsg') {
      if (!rest) {
        await sock.sendMessage(chatId, { text: T.setMsgUsage }, { quoted: message });
        return;
      }
      writeState(state.enabled, rest);
      await safeReact(sock, chatId, message.key, '✅');
      await sock.sendMessage(chatId, { text: T.msgUpdated }, { quoted: message });
      return;
    }

    const enable = sub === 'on';
    writeState(enable, null);

    await safeReact(sock, chatId, message.key, enable ? '✅' : '❌');
    await sock.sendMessage(chatId, { text: enable ? T.enabled : T.disabled }, { quoted: message });
  } catch (e) {
    console.error('[PMBLOCKER]', e?.stack || e);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: TT(chatId).T.help }, { quoted: message }).catch(() => {});
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'pmblocker',
  aliases: ['pmblocker', 'pmblock', 'blockpm', 'حظر_الخاص', 'قفل_الخاص'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'قفل/فتح استقبال رسائل الخاص للبوت وتعديل رسالة التحذير.',
    en: 'Enable/disable bot DM blocking and edit the warning message.'
  },
  usage: {
    ar: 'pmblocker on/off/status | pmblocker setmsg <رسالة>',
    en: 'pmblocker on/off/status | pmblocker setmsg <message>'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '🚫',
  exec: pmblockerCommand,
  run: pmblockerCommand,
  execute: pmblockerCommand,

  pmblockerCommand,
  readState,
  writeState,
  handleIncomingDM
};
