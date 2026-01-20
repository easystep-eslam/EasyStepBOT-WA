const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { isSudo } = require('../../lib/index');
const { getLang } = require('../../lib/lang');

const BANNED_PATH = path.join(process.cwd(), 'data', 'banned.json');

function ensureBannedFile() {
  try {
    const dir = path.dirname(BANNED_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(BANNED_PATH)) fs.writeFileSync(BANNED_PATH, JSON.stringify([], null, 2), 'utf8');
  } catch {}
}

function readBannedList() {
  try {
    ensureBannedFile();
    const raw = fs.readFileSync(BANNED_PATH, 'utf8') || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBannedList(list) {
  try {
    ensureBannedFile();
    fs.writeFileSync(BANNED_PATH, JSON.stringify(Array.isArray(list) ? list : [], null, 2), 'utf8');
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

function extractNumber(s = '') {
  return String(s || '').replace(/[^0-9]/g, '');
}

function safeMentionsFromContext(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  const replied = ctx.participant ? [ctx.participant] : [];
  return { mentioned, replied, ctx };
}

function parseArgs(message, args) {
  const raw = getText(message).trim();
  const first = (raw.split(/\s+/)[0] || 'ban').toLowerCase();
  let text = Array.isArray(args) && args.length ? args.join(' ').trim() : '';
  if (!text) text = raw.slice(first.length).trim();
  return text;
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);

  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botAdminNeed: '❌ Please make the bot an admin to use this command.',
      onlyAdmins: '❌ Only group admins can use this command.',
      privateOnlyOwner: '❌ Only owner/sudo can use this command in private chat.',
      needTarget: '❌ Please mention, reply, or provide a number to ban.\nExample: .ban 201234567890',
      cantBanBot: '❌ You cannot ban the bot account.',
      badNumber: '❌ Invalid number.\nExample: .ban 201234567890',
      bannedOk: (u) => `✅ Successfully banned @${u}!`,
      alreadyBanned: (u) => `ℹ️ @${u} is already banned!`,
      failed: '❌ Failed to ban user!'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botAdminNeed: '❌ لازم تخلي البوت أدمن عشان تستخدم الأمر ده.',
      onlyAdmins: '❌ الأمر ده للأدمنز فقط داخل الجروب.',
      privateOnlyOwner: '❌ الأمر ده في الخاص للمالك/سودو فقط.',
      needTarget: '❌ منشن/ريبلاي/أو اكتب رقم عشان تعمل حظر.\nمثال: .ban 201234567890',
      cantBanBot: '❌ مينفعش تعمل حظر لحساب البوت.',
      badNumber: '❌ رقم غير صحيح.\nمثال: .ban 201234567890',
      bannedOk: (u) => `✅ تم حظر @${u} بنجاح!`,
      alreadyBanned: (u) => `ℹ️ @${u} محظور بالفعل!`,
      failed: '❌ فشل حظر المستخدم!'
    }
  };

  return { lang, T: dict[lang] || dict.en };
}

async function getBotJids(sock) {
  try {
    const raw = sock?.user?.id || '';
    const num = String(raw).split('@')[0].split(':')[0];
    const botJid = num ? `${num}@s.whatsapp.net` : '';
    const botLid = botJid ? botJid.replace('@s.whatsapp.net', '@lid') : '';
    return [raw, botJid, botLid].filter(Boolean);
  } catch {
    return [];
  }
}

async function banCommand(sock, a, b) {
  const message = a?.key?.remoteJid ? a : null;
  const chatId = message?.key?.remoteJid || (typeof a === 'string' ? a : null);
  const args = Array.isArray(b) ? b : [];
  if (!chatId || !message) return;

  const { lang, T } = TXT(chatId);

  await safeReact(sock, chatId, message?.key, '⛔');

  const isGroup = chatId.endsWith('@g.us');
  const senderId = message.key.participant || message.key.remoteJid;

  if (isGroup) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
      await safeReact(sock, chatId, message?.key, '❌');
      await sock.sendMessage(chatId, { text: T.botAdminNeed }, { quoted: message });
      return;
    }

    if (!isSenderAdmin && !message.key.fromMe) {
      await safeReact(sock, chatId, message?.key, '🚫');
      await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });
      return;
    }
  } else {
    const senderIsSudo = await isSudo(senderId);
    if (!message.key.fromMe && !senderIsSudo) {
      await safeReact(sock, chatId, message?.key, '🚫');
      await sock.sendMessage(chatId, { text: T.privateOnlyOwner }, { quoted: message });
      return;
    }
  }

  const { mentioned, replied } = safeMentionsFromContext(message);
  let userToBan = null;

  if (mentioned.length) userToBan = mentioned[0];
  else if (replied.length) userToBan = replied[0];
  else {
    const text = parseArgs(message, args);
    const num = extractNumber(text);
    if (!num || num.length < 7 || num.length > 15) {
      await safeReact(sock, chatId, message?.key, '❌');
      await sock.sendMessage(chatId, { text: text ? T.badNumber : T.needTarget }, { quoted: message });
      return;
    }
    userToBan = `${num}@s.whatsapp.net`;
  }

  const botJids = await getBotJids(sock);
  if (botJids.includes(userToBan)) {
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.cantBanBot }, { quoted: message });
    return;
  }

  try {
    const bannedUsers = readBannedList();
    const num = userToBan.split('@')[0];

    if (!bannedUsers.includes(userToBan)) {
      bannedUsers.push(userToBan);

      const ok = writeBannedList(bannedUsers);
      await safeReact(sock, chatId, message?.key, ok ? '✅' : '❌');

      await sock.sendMessage(
        chatId,
        {
          text: ok ? T.bannedOk(num) : T.failed,
          mentions: [userToBan]
        },
        { quoted: message }
      );
      return;
    }

    await safeReact(sock, chatId, message?.key, 'ℹ️');
    await sock.sendMessage(
      chatId,
      { text: T.alreadyBanned(num), mentions: [userToBan] },
      { quoted: message }
    );
  } catch (error) {
    console.error('[BAN]', error?.message || error);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'ban',

  aliases: ['ban', 'banuser', 'حظر'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'حظر مستخدم (منشن/ريبلاي/رقم) ومنعه من استخدام البوت.',
    en: 'Ban a user (mention/reply/number) to prevent them from using the bot.'
  },

  usage: {
    ar: '.ban @user | (رد) | رقم',
    en: '.ban @user | (reply) | number'
  },

  emoji: '⛔',

  admin: true,
  owner: false,
  showInMenu: true,

  run: banCommand,
  exec: banCommand,
  execute: (sock, message, args) => banCommand(sock, message, args),

  banCommand
};