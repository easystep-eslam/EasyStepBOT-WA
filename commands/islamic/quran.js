const axios = require('axios');
const surahs = require('../../lib/quranSurahs');
const { getLang } = require('../../lib/lang');

async function quranCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '🕌', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      needNumber: '📖 Please type the surah number.\nExample: *.quran 35*',
      notFound: '❌ Surah number not found.',
      title: (name) => `🕌 *${name}*`,
      ayat: (n) => `📖 Verses: ${n}`,
      reciter: '🎙️ Reciter: Mishary Rashid Alafasy',
      verse: '﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾',
      fail: '❌ An error occurred while playing the surah.'
    },
    ar: {
      needNumber: '📖 اكتب رقم السورة\nمثال: *.سورة 35*',
      notFound: '❌ رقم السورة غير موجود',
      title: (name) => `🕌 *${name}*`,
      ayat: (n) => `📖 عدد الآيات: ${n}`,
      reciter: '🎙️ القارئ: مشاري راشد العفاسي',
      verse: '﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾',
      fail: '❌ حصل خطأ أثناء تشغيل السورة'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const input = (args && args[0]) ? String(args[0]).trim() : '';
    if (!input || isNaN(input)) {
      return await sock.sendMessage(chatId, { text: T.needNumber }, { quoted: message });
    }

    const surahNumber = parseInt(input, 10);
    const surah = Array.isArray(surahs) ? surahs.find((s) => s.n === surahNumber) : null;

    if (!surah) {
      return await sock.sendMessage(chatId, { text: T.notFound }, { quoted: message });
    }

    const apiURL = `https://api.quran.com/api/v4/chapter_recitations/7/${surahNumber}`;
    const res = await axios.get(apiURL, { timeout: 15000 });

    const audioURL = res?.data?.audio_file?.audio_url;
    if (!audioURL) {
      return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
    }

    const infoText =
      `${T.title(surah.name)}\n\n` +
      `${T.ayat(surah.ayat)}\n` +
      `${T.reciter}\n\n` +
      `${T.verse}`;

    await sock.sendMessage(chatId, { text: infoText }, { quoted: message });

    return await sock.sendMessage(
      chatId,
      { audio: { url: audioURL }, mimetype: 'audio/mpeg', ptt: false },
      { quoted: message }
    );
  } catch (err) {
    console.error('Quran command error:', err);
    return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'quran',
  aliases: ['سورة', 'قرآن'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'تشغيل سورة برقمها بصوت مشاري راشد العفاسي',
    en: 'Play a Surah by number with Mishary Rashid Alafasy recitation'
  },
  emoji: '📖',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: quranCommand
};