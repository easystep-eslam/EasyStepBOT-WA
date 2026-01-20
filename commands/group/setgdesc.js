const { setGroupDescription } = require('./groupmanage');
const { getLang } = require('../../lib/lang');

async function setDescCommand(sock, chatId, message, args = [], senderId) {
  const lang = getLang(chatId);

  try {
    await sock.sendMessage(chatId, {
      react: { text: '✍️', key: message.key }
    });

    await setGroupDescription(
      sock,
      chatId,
      senderId || message.key.participant || message.key.remoteJid,
      args.join(' ').trim(),
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
            ? '❌ حصل خطأ أثناء تغيير وصف الجروب.'
            : '❌ Failed to change group description.'
      },
      { quoted: message }
    );
  }
}

module.exports = {
  name: 'setgdesc',

  aliases: ['setgdesc', 'gdesc', 'وصف_الجروب'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'تغيير وصف الجروب.',
    en: 'Change the group description.'
  },

  usage: {
    ar: '.setgdesc <الوصف الجديد>',
    en: '.setgdesc <new description>'
  },

  emoji: '✍️',

  admin: true,
  owner: false,
  showInMenu: true,

  exec: (sock, message, args, senderId) =>
    setDescCommand(sock, message.key.remoteJid, message, args, senderId),

  run: (sock, chatId, message, args, senderId) =>
    setDescCommand(sock, chatId, message, args, senderId),

  execute: (sock, chatId, message, args, senderId) =>
    setDescCommand(sock, chatId, message, args, senderId)
};