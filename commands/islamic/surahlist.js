const surahs = require('../../lib/quranSurahs');
const { getLang } = require('../../lib/lang');

const toArabicNumber = (num) =>
  String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

async function surahlistCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '📖', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      title: '📖 *List of Quran Surahs*',
      play: '📌 *To play a surah:*',
      cmd1: '.quran (surah number)',
      cmd2: '.surah (surah number)',
      footer: '🤲 *_May Allah make us among the people of the Quran_*'
    },
    ar: {
      title: '📖 *قائمة سور القرآن الكريم*',
      play: '📌 *لتشغيل سورة:*',
      cmd1: '.quran (رقم السورة)',
      cmd2: '.سورة (رقم السورة)',
      footer: '🤲 *_جعلنا الله وإياكم من أهل القرآن_*'
    }
  };

  const T = TXT[lang] || TXT.ar;

  let text = `${T.title}\n══════════════════\n\n`;

  (Array.isArray(surahs) ? surahs : []).forEach(s => {
    text += lang === 'ar'
      ? `﴿ ${toArabicNumber(s.n)} ﴾ ${s.name} (${toArabicNumber(s.ayat)} آية)\n`
      : `(${s.n}) ${s.name} (${s.ayat} verses)\n`;
  });

  text += `\n══════════════════\n`;
  text += `${T.play}\n${T.cmd1}\n${T.cmd2}\n\n${T.footer}`;

  return await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = {
  name: 'surahlist',
  aliases: ['quranlist', 'listquran', 'السور'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'عرض قائمة سور القرآن الكريم',
    en: 'Show the list of Quran surahs'
  },
  emoji: '📖',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: surahlistCommand
};