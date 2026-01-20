const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

function ensureWarningsFile() {
  if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
  if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}, null, 2), 'utf8');
}

function readWarningsSafe() {
  try {
    const raw = fs.readFileSync(warningsPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeWarningsSafe(warnings) {
  try {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function warnCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      onlyGroups: 'This command can only be used in groups.',
      botAdminFirst: '❌ Please make the bot an admin first.',
      onlyAdmins: '🚫 Only group admins can use this command.',
      noTarget: 'ℹ️ Mention a user or reply to their message to warn.',
      warnFail: '❌ Failed to warn user.',
      kickText: (u) => `『 AUTO-REMOVE 』\n\n@${u} has been removed after receiving 3 warnings.`,
      warnText: (warnedUser, count, sender) =>
        `『 WARNING 』\n\n` +
        `User: @${warnedUser}\n` +
        `Warnings: ${count}/3\n` +
        `By: @${sender}\n` +
        `Date: ${new Date().toLocaleString()}`
    },
    ar: {
      onlyGroups: 'الأمر ده شغال في الجروبات بس.',
      botAdminFirst: '❌ لازم تخلي البوت أدمن الأول.',
      onlyAdmins: '🚫 الأمر ده للأدمنز بس.',
      noTarget: 'ℹ️ منشن الشخص أو اعمل ريبلاي على رسالته عشان تعمل تحذير.',
      warnFail: '❌ فشل تنفيذ التحذير.',
      kickText: (u) => `『 إزالة تلقائية 』\n\n@${u} تم طرده بعد الوصول إلى 3 تحذيرات.`,
      warnText: (warnedUser, count, sender) =>
        `『 تحذير 』\n\n` +
        `العضو: @${warnedUser}\n` +
        `عدد التحذيرات: ${count}/3\n` +
        `بواسطة: @${sender}\n` +
        `التاريخ: ${new Date().toLocaleString()}`
    }
  };

  const T = TXT[lang] || TXT.en;

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.onlyGroups }, { quoted: message });
    return;
  }

  const adminStatus = await isAdmin(sock, chatId, senderId);

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botAdminFirst }, { quoted: message });
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });
    return;
  }

  const ctx = message.message?.extendedTextMessage?.contextInfo;
  const mentioned = ctx?.mentionedJid || [];
  let userToWarn = null;

  if (mentioned.length) userToWarn = mentioned[0];
  else if (ctx?.participant) userToWarn = ctx.participant;

  if (!userToWarn) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.noTarget }, { quoted: message });
    return;
  }

  ensureWarningsFile();

  const warnings = readWarningsSafe();
  if (!warnings[chatId]) warnings[chatId] = {};
  if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;

  warnings[chatId][userToWarn] += 1;
  const count = warnings[chatId][userToWarn];

  if (!writeWarningsSafe(warnings)) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.warnFail }, { quoted: message });
    return;
  }

  const warnedNum = userToWarn.split('@')[0];
  const senderNum = senderId.split('@')[0];

  await safeReact(sock, chatId, message.key, '⚠️');
  await sock.sendMessage(
    chatId,
    { text: T.warnText(warnedNum, count, senderNum), mentions: [userToWarn, senderId] },
    { quoted: message }
  );

  if (count >= 3) {
    try {
      await sock.groupParticipantsUpdate(chatId, [userToWarn], 'remove');
      const warnings2 = readWarningsSafe();
      if (warnings2[chatId]?.[userToWarn]) {
        delete warnings2[chatId][userToWarn];
        writeWarningsSafe(warnings2);
      }

      await safeReact(sock, chatId, message.key, '🚫');
      await sock.sendMessage(
        chatId,
        { text: T.kickText(warnedNum), mentions: [userToWarn] },
        { quoted: message }
      );
    } catch {
      await safeReact(sock, chatId, message.key, '❌');
    }
  }
}

module.exports = {
  name: 'warn',
  aliases: ['warning', 'تحذير', 'انذار', 'إنذار'],

  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },

  description: {
    ar: 'إعطاء تحذير لعضو داخل الجروب، والطرد التلقائي عند الوصول إلى 3 تحذيرات.',
    en: 'Give a warning to a group member, with automatic removal after 3 warnings.'
  },
emoji: '🚨',
  admin: true,
  owner: false,
  showInMenu: true,

  run: warnCommand,
  exec: warnCommand,
  execute: (sock, message) => warnCommand(sock, message),

  warnCommand
};