const { setGroupPhoto } = require('./groupmanage');
const { getLang } = require('../../lib/lang');

async function setGppCommand(sock, chatId, message, args = [], senderId) {
  const lang = getLang(chatId);

  try {
    await sock.sendMessage(chatId, {
      react: { text: '🖼️', key: message.key }
    });

    await setGroupPhoto(
      sock,
      chatId,
      senderId || message.key.participant || message.key.remoteJid,
      message
    );

    await sock.sendMessage(chatId, {
      react: { text: '✅', key: message.key }
    });
  } catch (e) {
    await sock.sendMessage(chatId, {
      react: { text: '❌', key: message.key }
    });

    await sock.sendMessage(
      chatId,
      {
        text:
          lang === 'ar'
            ? '❌ حصل خطأ أثناء تغيير صورة الجروب.'
            : '❌ Failed to change group photo.'
      },
      { quoted: message }
    );
  }
}

module.exports = {
  name: 'setgpp',

  aliases: ['setgpp', 'gpp', 'صورة_الجروب'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'تغيير صورة الجروب.',
    en: 'Change the group photo.'
  },

  usage: {
    ar: 'أرسل صورة مع الأمر أو رد على صورة.',
    en: 'Send an image with the command or reply to an image.'
  },

  emoji: '🖼️',

  admin: true,
  owner: false,
  showInMenu: true,

  exec: (sock, message, args, senderId) =>
    setGppCommand(sock, message.key.remoteJid, message, args, senderId),

  run: (sock, chatId, message, args, senderId) =>
    setGppCommand(sock, chatId, message, args, senderId),

  execute: (sock, chatId, message, args, senderId) =>
    setGppCommand(sock, chatId, message, args, senderId)
};