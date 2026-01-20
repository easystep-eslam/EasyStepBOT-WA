const isAdmin = require('../../lib/isAdmin');
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

function extractArgs(message, args) {
  if (Array.isArray(args) && args.length) return args;
  const raw = getText(message).trim();
  const used = (raw.split(/\s+/)[0] || 'gc').trim();
  const rest = raw.slice(used.length).trim();
  return rest ? rest.split(/\s+/) : [];
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
      botAdmin: '❌ Please make the bot an admin first.',
      senderAdmin: '❌ Only group admins can use this command.',
      usage: 'ℹ️ Usage:\n.gc open\n.gc close',
      opened: '🔓 Group has been opened for everyone.',
      closed: '🔒 Group has been closed (admins only).',
      invalid: '❌ Invalid action. Use: open or close',
      error: '❌ Something went wrong. Make sure the bot is admin.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      senderAdmin: '❌ الأمر ده للأدمنية بس.',
      usage: 'ℹ️ الاستخدام:\n.gc فتح\n.gc قفل\n.gc open\n.gc close',
      opened: '🔓 تم فتح الجروب للجميع.',
      closed: '🔒 تم قفل الجروب (للأدمن فقط).',
      invalid: '❌ أمر غير صحيح. استخدم: فتح/قفل أو open/close',
      error: '❌ حصلت مشكلة. اتأكد إن البوت أدمن.'
    }
  };
  return { lang, T: dict[lang] || dict.en };
}

async function gcCommand(sock, message, args) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const senderId = message.key.participant || chatId;
  const { T } = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  let adminStatus;
  try {
    adminStatus = await isAdmin(sock, chatId, senderId);
  } catch {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
    return;
  }

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '🛡️');
    await sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.senderAdmin }, { quoted: message });
    return;
  }

  const parts = extractArgs(message, args);
  const action = String(parts?.[0] || '').toLowerCase().trim();

  if (!action) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    return;
  }

  const isOpen = action === 'open' || action === 'فتح';
  const isClose = action === 'close' || action === 'قفل';

  try {
    if (isOpen) {
      await safeReact(sock, chatId, message.key, '🔓');
      await sock.groupSettingUpdate(chatId, 'not_announcement');
      await sock.sendMessage(chatId, { text: T.opened }, { quoted: message });
      return;
    }

    if (isClose) {
      await safeReact(sock, chatId, message.key, '🔒');
      await sock.groupSettingUpdate(chatId, 'announcement');
      await sock.sendMessage(chatId, { text: T.closed }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.invalid }, { quoted: message });
  } catch (err) {
    console.error('[GC]', err?.stack || err);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'gc',
  aliases: ['gc', 'group', 'grub'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'التحكم في وضع الجروب: فتح للجميع أو قفل (للأدمن فقط) لمنع إرسال الرسائل من الأعضاء.',
    en: 'Controls group chat mode: open for everyone or close (admins only) to prevent members from sending messages.'
  },
  usage: {
    ar: '.gc open | close',
    en: '.gc open | close'
  },
emoji: '🚪',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: gcCommand,
  run: gcCommand,
  execute: (sock, message, args) => gcCommand(sock, message, args),
  gcCommand
};