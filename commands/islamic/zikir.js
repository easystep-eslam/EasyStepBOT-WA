const zikrList = require('../../data/zikr');
const { getLang } = require('../../lib/lang');

function pickZikrText(entry, lang) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return entry[lang] || entry.ar || entry.en || '';
}

async function zikrCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '📿', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      empty: '❌ Zikr list is empty or not available.',
      title: '📿 *Zikr*',
      footer: '🤲 Do not forget the remembrance of Allah.'
    },
    ar: {
      empty: '❌ ملف الأذكار غير موجود أو فارغ.',
      title: '📿 *ذكر*',
      footer: '🤲 لا تنسَ ذكر الله.'
    }
  };

  const T = TXT[lang] || TXT.ar;

  if (!Array.isArray(zikrList) || zikrList.length === 0) {
    return await sock.sendMessage(chatId, { text: T.empty }, { quoted: message });
  }

  const randomEntry = zikrList[Math.floor(Math.random() * zikrList.length)];
  const zikrText = pickZikrText(randomEntry, lang);

  const text =
    `${T.title}\n\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `${zikrText}\n\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `${T.footer}`;

  return await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = {
  name: 'zikr',
  aliases: ['zikir', 'ذكر', 'اذكار', 'أذكار'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'إرسال ذكر عشوائي',
    en: 'Send a random zikr'
  },
  emoji: '📿',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: zikrCommand
};