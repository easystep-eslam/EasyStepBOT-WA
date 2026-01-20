const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

const PMBLOCKER_PATH = path.join(process.cwd(), 'data', 'pmblocker.json');

const DEFAULT_MSG_EN =
  '⚠️ Direct messages are blocked!\nYou cannot DM this bot. Please contact the owner in group chats only.';
const DEFAULT_MSG_AR =
  '⚠️ الرسائل الخاصة مقفولة!\nمينفعش تبعت للبوت برايفت. تواصل مع الأدمن التاني اللي نزل المنشور ومعمول ليه منشن في الرساله.';

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
        `pmblocker setmsg <message> - set warning message`,
      status: (on, msg) =>
        `🔒 PM Blocker: *${on ? 'ON' : 'OFF'}*\n\n📝 Message:\n${msg}`,
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
        `pmblocker setmsg <رسالة> - تغيير رسالة التحذير`,
      status: (on, msg) =>
        `🔒 حظر الخاص: *${on ? 'ON' : 'OFF'}*\n\n📝 الرسالة:\n${msg}`,
      setMsgUsage: '📌 الاستخدام: pmblocker setmsg <رسالة>',
      msgUpdated: '✅ تم تحديث رسالة حظر الخاص.',
      enabled: '✅ تم تفعيل حظر الخاص.',
      disabled: '❌ تم إيقاف حظر الخاص.'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

function defaultMsgFor(lang) {
  return lang === 'ar' ? DEFAULT_MSG_AR : DEFAULT_MSG_EN;
}

function readState(chatIdForLang) {
  const lang = chatIdForLang ? getLang(chatIdForLang) : 'en';
  const def = defaultMsgFor(lang);

  try {
    if (!fs.existsSync(PMBLOCKER_PATH)) return { enabled: false, message: def };

    const raw = fs.readFileSync(PMBLOCKER_PATH, 'utf8');
    const data = JSON.parse(raw || '{}') || {};

    return {
      enabled: !!data.enabled,
      message:
        typeof data.message === 'string' && data.message.trim() ? data.message.trim() : def
    };
  } catch {
    return { enabled: false, message: def };
  }
}

function writeState(chatIdForLang, enabled, message) {
  try {
    const lang = chatIdForLang ? getLang(chatIdForLang) : 'en';
    const def = defaultMsgFor(lang);

    const dir = path.dirname(PMBLOCKER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const current = readState(chatIdForLang);

    const payload = {
      enabled: !!enabled,
      message:
        typeof message === 'string' && message.trim()
          ? message.trim()
          : (current.message || def)
    };

    fs.writeFileSync(PMBLOCKER_PATH, JSON.stringify(payload, null, 2));
  } catch {}
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

    let sub = String(list[0] || '').toLowerCase();
    const rest = list.slice(1).join(' ').trim();

    const state = readState(chatId);

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
      writeState(chatId, state.enabled, rest);
      await safeReact(sock, chatId, message.key, '✅');
      await sock.sendMessage(chatId, { text: T.msgUpdated }, { quoted: message });
      return;
    }

    const enable = sub === 'on';
    writeState(chatId, enable, null);

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
  writeState
};
