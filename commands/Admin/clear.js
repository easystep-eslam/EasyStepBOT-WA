const { getLang } = require('../../lib/lang');

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
      clearing: '🧹 Clearing bot messages...',
      done: '✅ Bot messages cleared.',
      error: '❌ An error occurred while clearing messages.'
    },
    ar: {
      clearing: '🧹 جاري مسح رسائل البوت...',
      done: '✅ تم مسح رسائل البوت.',
      error: '❌ حصل خطأ أثناء مسح الرسائل.'
    }
  };

  return dict[lang] || dict.en;
}

async function clearCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const T = TXT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '🧹');

    const sent = await sock.sendMessage(chatId, { text: T.clearing });

    await sock.sendMessage(chatId, { delete: sent.key }).catch(() => {});

    await safeReact(sock, chatId, message.key, '🗑️');

  } catch (error) {
    console.error('[CLEAR]', error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'clear',
  aliases: ['clear', 'مسح', 'تنظيف'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'يمسح رسائل البوت (حذف رسالة التنفيذ/التأكيد) للحفاظ على نظافة الشات.',
    en: 'Clears bot messages (deletes the execution/confirmation message) to keep the chat clean.'
  },
  emoji: '🧹',

  admin: true,
  owner: false,
  showInMenu: true,
  run: clearCommand,
  exec: clearCommand,
  execute: (sock, message, args) => clearCommand(sock, message, args),
  clearCommand
};