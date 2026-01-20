const axios = require('axios');
const { getLang } = require('../../lib/lang');

async function weatherCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      needCity: 'Please provide a city name.\nExample: .weather Cairo',
      result: (w) =>
        `🌤 *Weather in ${w.name}*\n\n` +
        `• Condition: ${w.weather?.[0]?.description || '-'}\n` +
        `• Temperature: ${w.main?.temp ?? '-'}°C\n` +
        `• Feels Like: ${w.main?.feels_like ?? '-'}°C\n` +
        `• Humidity: ${w.main?.humidity ?? '-'}%\n\n` +
        `Powered by EasyStep`,
      notFound: '❌ City not found. Please check the spelling and try again.',
      error: 'Sorry, I could not fetch the weather right now.'
    },
    ar: {
      needCity: 'من فضلك اكتب اسم المدينة.\nمثال: .weather القاهرة',
      result: (w) =>
        `🌤 *الطقس في ${w.name}*\n\n` +
        `• الحالة: ${w.weather?.[0]?.description || '-'}\n` +
        `• درجة الحرارة: ${w.main?.temp ?? '-'}°C\n` +
        `• المحسوسة: ${w.main?.feels_like ?? '-'}°C\n` +
        `• الرطوبة: ${w.main?.humidity ?? '-'}%\n\n` +
        `بواسطة EasyStep`,
      notFound: '❌ مش لاقي المدينة دي. اتأكد من الاسم وجرب تاني.',
      error: 'حصل خطأ ومقدرتش أجيب حالة الطقس دلوقتي.'
    }
  };

  const T = TXT[lang] || TXT.en;

  // Reminder: Extract message text
  const rawText =
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    '';

  const used = (rawText || '').split(/\s+/)[0] || '.weather';
  const city = rawText.slice(used.length).trim();

  if (!city) {
    await sock.sendMessage(chatId, { text: T.needCity }, { quoted: message });
    return;
  }

  try {
    // React مناسب للأمر
    try {
      await sock.sendMessage(chatId, { react: { text: '🌤', key: message.key } });
    } catch {}

    const apiKey = '4902c0f2550f58298ad4146a92b65e10';

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
      )}&appid=${apiKey}&units=metric&lang=${lang === 'ar' ? 'ar' : 'en'}`,
      { timeout: 15000 }
    );

    await sock.sendMessage(chatId, { text: T.result(response.data) }, { quoted: message });
  } catch (error) {
    console.error('[WEATHER] error:', error?.message || error);

    if (error?.response?.status === 404) {
      await sock.sendMessage(chatId, { text: T.notFound }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'weather',
  aliases: ['w', 'forecast', 'طقس', 'الطقس', 'جو', 'حرارة'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'عرض حالة الطقس لمدينة معينة.',
    en: 'Show current weather for a city.'
  },
  usage: {
    ar: '.weather <اسم_المدينة>',
    en: '.weather <city>'
  },
  emoji: '🌤️',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: weatherCommand
};