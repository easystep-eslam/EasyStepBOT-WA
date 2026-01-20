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
      noMembers: '❌ No participants found in the group.',
      header: '🔊 *Hello Everyone:*',
      error: '❌ Failed to tag all members.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      senderAdmin: '❌ الأمر ده للأدمن بس.',
      noMembers: '❌ مفيش أعضاء في الجروب.',
      header: '🔊 *منشن جماعي:*',
      error: '❌ حصل خطأ أثناء المنشن.'
    }
  };

  return { lang, T: dict[lang] || dict.en };
}

function extractArgs(message, args) {
  if (Array.isArray(args) && args.length) return args;
  const raw = String(getText(message) || '').trim();
  const used = (raw.split(/\s+/)[0] || 'tagall').trim();
  const rest = raw.slice(used.length).trim();
  return rest ? rest.split(/\s+/) : [];
}

async function tagallCommand(sock, message, args = []) {
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
  } catch (e) {
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

  if (!participants.length) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.noMembers }, { quoted: message });
    return;
  }

  const parts = extractArgs(message, args);
  const extraText = parts.join(' ').trim();
  const headerLine = extraText ? `${T.header}\n${extraText}\n` : T.header;

  const jids = participants.map(p => p.id || p.jid).filter(Boolean);
  const lines = jids.map(j => `@${String(j).split('@')[0]}`).join('\n');

  await safeReact(sock, chatId, message.key, '✅');
  await sock.sendMessage(
    chatId,
    { text: `${headerLine}\n\n${lines}`.trim(), mentions: jids },
    { quoted: message }
  );
}

module.exports = {
  name: 'tagall',
  aliases: ['tagall', 'all', 'mentionall', 'منشن_الكل', 'منشن', 'تاگ_الكل', 'تاج_الكل', 'الكل'],

  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },

  description: {
    ar: 'منشن جماعي لكل أعضاء الجروب مع إمكانية إضافة نص بعد الأمر يظهر قبل المنشن.',
    en: 'Mentions all group members, with optional text after the command shown before mentions.'
  },

  usage: {
    ar: '.tagall [نص اختياري]',
    en: '.tagall [optional text]'
  },
emoji: '📣👥',
  admin: true,
  owner: false,
  showInMenu: true,

  run: tagallCommand,
  exec: tagallCommand,
  execute: (sock, message, args) => tagallCommand(sock, message, args),

  tagallCommand
};