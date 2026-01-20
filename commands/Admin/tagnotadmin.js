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
  const raw = String(getText(message) || '').trim();
  const used = (raw.split(/\s+/)[0] || 'tagnotadmin').trim();
  const rest = raw.slice(used.length).trim();
  return rest ? rest.split(/\s+/) : [];
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
      groupOnly: '❌ This command works in groups only.',
      botAdmin: '❌ Please make the bot an admin first.',
      senderAdmin: '❌ Only group admins can use this command.',
      noUsers: '❌ No non-admin members to tag.',
      header: '🔊 *Tagging non-admin members:*',
      failed: '❌ Failed to tag non-admin members.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      senderAdmin: '❌ الأمر ده للأدمن بس.',
      noUsers: '❌ مفيش أعضاء غير أدمن أعملهم منشن.',
      header: '🔊 *منشن لغير الأدمن:*',
      failed: '❌ فشل منشن غير الأدمن.'
    }
  };

  return { lang, T: dict[lang] || dict.en };
}

async function tagNotAdminCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message.key, '📣');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  let adminStatus;
  try {
    adminStatus = await isAdmin(sock, chatId, senderId);
  } catch {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });
    return;
  }

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.senderAdmin }, { quoted: message });
    return;
  }

  let participants = [];
  try {
    const meta = await sock.groupMetadata(chatId);
    participants = meta?.participants || [];
  } catch {
    participants = [];
  }

  const nonAdmins = participants
    .filter(p => !(p.admin === 'admin' || p.admin === 'superadmin'))
    .map(p => p.id || p.jid)
    .filter(Boolean);

  if (!nonAdmins.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.noUsers }, { quoted: message });
    return;
  }

  const parts = extractArgs(message, args);
  const extraText = parts.join(' ').trim();
  const headerLine = extraText ? `${T.header}\n${extraText}\n` : T.header;

  const lines = nonAdmins.map(j => `@${String(j).split('@')[0]}`).join('\n');

  try {
    await safeReact(sock, chatId, message.key, '✅');
    await sock.sendMessage(
      chatId,
      { text: `${headerLine}\n\n${lines}`.trim(), mentions: nonAdmins },
      { quoted: message }
    );
  } catch (e) {
    console.error('tagnotadmin error:', e);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'tagnotadmin',
  aliases: [
    'tagnotadmin',
    'notadmin',
    'mentionnotadmin',
    'منشن_غير_ادمن',
    'منشن_غير_أدمن',
    'منشن_الاعضاء',
    'منشن_الناس',
    'غير_ادمن',
    'غير_أدمن'
  ],

  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },

  description: {
    ar: 'منشن لكل أعضاء الجروب غير الأدمن فقط، مع إمكانية إضافة نص اختياري بعد الأمر يظهر قبل المنشن.',
    en: 'Mentions only non-admin members in the group, with optional text after the command shown before mentions.'
  },

  usage: {
    ar: '.tagnotadmin [نص اختياري]',
    en: '.tagnotadmin [optional text]'
  },
emoji: '👤👤',
  admin: true,
  owner: false,
  showInMenu: true,

  run: tagNotAdminCommand,
  exec: tagNotAdminCommand,
  execute: (sock, message, args) => tagNotAdminCommand(sock, message, args),

  tagNotAdminCommand
};