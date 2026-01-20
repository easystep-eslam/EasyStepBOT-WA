const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { isSudo } = require('../../lib/index');
const { getLang } = require('../../lib/lang');

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
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);

  const dict = {
    en: {
      botNotAdmin: '❌ Please make the bot an admin to use this command.',
      onlyAdmins: '🚫 Only group admins can use this command.',
      onlyOwnerSudo: '🚫 Only owner/sudo can use this command in private chat.',
      needTarget: 'ℹ️ Mention the user, reply to their message, or provide a number to unban.',
      unbanned: (u) => `✅ Successfully unbanned @${u}.`,
      notBanned: (u) => `ℹ️ @${u} is not banned.`,
      failed: '❌ Failed to unban user.'
    },
    ar: {
      botNotAdmin: '❌ لازم تخلي البوت أدمن علشان تستخدم الأمر ده.',
      onlyAdmins: '🚫 الأمر ده للأدمنز بس داخل الجروب.',
      onlyOwnerSudo: '🚫 الأمر ده في الخاص للمالك/سودو فقط.',
      needTarget: 'ℹ️ منشن الشخص أو اعمل ريبلاي على رسالته أو اكتب رقم علشان تفك الحظر.',
      unbanned: (u) => `✅ تم فك الحظر عن @${u}.`,
      notBanned: (u) => `ℹ️ @${u} مش محظور أصلاً.`,
      failed: '❌ حصل خطأ ومقدرتش أفك الحظر.'
    }
  };

  return dict[lang] || dict.en;
}

function extractTarget(message, args) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;

  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0];
  if (ctx?.participant) return ctx.participant;

  const fromArgs = Array.isArray(args) && args.length ? args.join(' ') : '';
  const rawText = fromArgs || String(getText(message) || '').trim();
  const digits = rawText.replace(/[^\d]/g, '');

  if (digits.length >= 7 && digits.length <= 15) return `${digits}@s.whatsapp.net`;

  return null;
}

function ensureBannedFile() {
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'banned.json');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  return filePath;
}

function readBannedList(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBannedList(filePath, list) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(Array.isArray(list) ? list : [], null, 2));
    return true;
  } catch {
    return false;
  }
}

async function unbanCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const T = TXT(chatId);

  await safeReact(sock, chatId, message.key, '🔓');

  const isGroup = chatId.endsWith('@g.us');

  if (isGroup) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.botNotAdmin }, { quoted: message });
      return;
    }

    if (!isSenderAdmin && !message.key.fromMe) {
      await safeReact(sock, chatId, message.key, '🚫');
      await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });
      return;
    }
  } else {
    const senderIsSudo = await isSudo(senderId);

    if (!message.key.fromMe && !senderIsSudo) {
      await safeReact(sock, chatId, message.key, '🚫');
      await sock.sendMessage(chatId, { text: T.onlyOwnerSudo }, { quoted: message });
      return;
    }
  }

  const target = extractTarget(message, args);

  if (!target) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.needTarget }, { quoted: message });
    return;
  }

  try {
    const filePath = ensureBannedFile();
    const bannedUsers = readBannedList(filePath);

    const idx = bannedUsers.indexOf(target);
    const tag = String(target).split('@')[0];

    if (idx > -1) {
      bannedUsers.splice(idx, 1);
      const ok = writeBannedList(filePath, bannedUsers);

      await safeReact(sock, chatId, message.key, ok ? '✅' : '❌');
      await sock.sendMessage(
        chatId,
        { text: ok ? T.unbanned(tag) : T.failed, mentions: [target] },
        { quoted: message }
      );
      return;
    }

    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(
      chatId,
      { text: T.notBanned(tag), mentions: [target] },
      { quoted: message }
    );
  } catch (error) {
    console.error('Error in unban command:', error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'unban',
  aliases: ['unblock', 'فك_حظر', 'الغاء_حظر', 'سماح'],

  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },

  description: {
    ar: 'فك حظر عضو من قائمة الحظر (منشن/ريبلاي/رقم). يعمل في الجروب للأدمن، وفي الخاص للمالك/سودو.',
    en: 'Unban a user from the ban list (mention/reply/number). Works in groups for admins, and in private for owner/sudo.'
  },

  usage: {
    ar: '.unban @user | (ريبلاي) | رقم',
    en: '.unban @user | (reply) | number'
  },
emoji: '🔓',
  admin: true,
  owner: false,
  showInMenu: true,

  run: unbanCommand,
  exec: unbanCommand,
  execute: (sock, message, args) => unbanCommand(sock, message, args),

  unbanCommand
};