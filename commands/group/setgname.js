const { setGroupName } = require('./groupmanage');
const { getLang } = require('../../lib/lang');

async function setNameCommand(sock, chatId, message, args = [], senderId) {
  const lang = getLang(chatId);

  try {
    await sock.sendMessage(chatId, {
      react: { text: '✏️', key: message.key }
    });

    await setGroupName(
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
            ? '❌ حصل خطأ أثناء تغيير اسم الجروب.'
            : '❌ Failed to change group name.'
      },
      { quoted: message }
    );
  }
}

module.exports = {
  name: 'setgname',

  aliases: ['setgname', 'gname', 'اسم_الجروب'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'تغيير اسم الجروب.',
    en: 'Change the group name.'
  },

  usage: {
    ar: '.setgname <الاسم الجديد>',
    en: '.setgname <new name>'
  },

  emoji: '✏️',

  admin: true,
  owner: false,
  showInMenu: true,

  exec: (sock, message, args, senderId) =>
    setNameCommand(sock, message.key.remoteJid, message, args, senderId),

  run: (sock, chatId, message, args, senderId) =>
    setNameCommand(sock, chatId, message, args, senderId),

  execute: (sock, chatId, message, args, senderId) =>
    setNameCommand(sock, chatId, message, args, senderId)
};