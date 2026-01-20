const { handleAntiBadwordCommand } = require('../../lib/antibadword');
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
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const base = {
    en: {
      adminOnly: '❌ This command is for group admins only.',
      error: '❌ Error while processing antibadword command.'
    },
    ar: {
      adminOnly: '❌ الأمر ده خاص بمشرفين الجروب فقط.',
      error: '❌ حصل خطأ أثناء تنفيذ أمر منع الكلمات.'
    }
  };
  return { lang, T: base[lang] || base.en };
}

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message?.key, '🧼');

  if (!isSenderAdmin && !message?.key?.fromMe) {
    await safeReact(sock, chatId, message?.key, '🚫');
    await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    return;
  }

  try {
    const raw = getText(message).trim();
    const used = (raw.split(/\s+/)[0] || 'antibadword').toLowerCase();
    const rest = raw.slice(used.length).trim();

    await handleAntiBadwordCommand(sock, chatId, message, rest);
    await safeReact(sock, chatId, message?.key, '✅');
  } catch (error) {
    console.error('Error in antibadword command:', error);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'antibadword',
  aliases: ['antibadword', 'منع_الكلمات', 'منع_كلمات'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'منع الكلمات داخل الجروب: تشغيل/إيقاف وإدارة الكلمات الممنوعة حسب إعدادات النظام.',
    en: 'Bad-words protection for the group: enable/disable and manage blocked words via system settings.'
  },

  usage: {
    ar: '.antibadword on | off | add <word> | remove <word> | list',
    en: '.antibadword on | off | add <word> | remove <word> | list'
  },

  emoji: '🧼',

  admin: true,
  owner: false,
  showInMenu: true,

  run: antibadwordCommand,
  exec: antibadwordCommand,
  execute: (sock, message, args) =>
    antibadwordCommand(sock, message?.key?.remoteJid, message, message?.key?.participant, true),

  antibadwordCommand
};