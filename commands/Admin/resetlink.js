const { getLang } = require('../../lib/lang');
const isAdmin = require('../../lib/isAdmin');

function TXT(chatId) {
  const lang = getLang(chatId);
  const dict = {
    en: {
      groupOnly: '❌ This command can only be used in groups.',
      botAdmin: '❌ Please make the bot an admin first.',
      senderAdmin: '❌ Only group admins can use this command!',
      done: (code) => `🔁 Group link has been reset.\n\n📌 New link:\nhttps://chat.whatsapp.com/${code}`,
      fail: '❌ Failed to reset group link!'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      botAdmin: '❌ لازم البوت يبقى أدمن الأول.',
      senderAdmin: '❌ الأمر ده للأدمنية بس!',
      done: (code) => `🔁 تم تغيير رابط الجروب.\n\n📌 الرابط الجديد:\nhttps://chat.whatsapp.com/${code}`,
      fail: '❌ فشل تغيير رابط الجروب!'
    }
  };
  return { lang, T: dict[lang] || dict.en };
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function resetLinkCommand(sock, chatId, message) {
  const { T } = TXT(chatId);
  const senderId = message.key.participant || message.key.remoteJid;

  await safeReact(sock, chatId, message.key, '🔁');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);

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

  try {
    const newCode = await sock.groupRevokeInvite(chatId);
    await safeReact(sock, chatId, message.key, '✅');
    await sock.sendMessage(chatId, { text: T.done(newCode) }, { quoted: message });
  } catch (error) {
    console.error('Error in resetlink command:', error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'resetlink',
  commands: ['resetlink'],
  aliases: ['newlink', 'revoke', 'رابط_جديد', 'تغيير_الرابط'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'إعادة تعيين رابط دعوة الجروب وإرسال الرابط الجديد.',
    en: 'Reset the group invite link and send the new one.'
  },
  usage: {
    ar: '.resetlink',
    en: '.resetlink'
  },
  emoji: '♻️',
  admin: true,
  owner: false,
  showInMenu: true,
  run: (sock, chatId, message) => resetLinkCommand(sock, chatId, message),
  exec: (sock, message) => resetLinkCommand(sock, message.key.remoteJid, message),
  execute: (sock, message) => resetLinkCommand(sock, message.key.remoteJid, message)
};