const axios = require('axios');
const { getLang } = require('../../lib/lang');

async function prayCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '🕌', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      title: '🕌 *Prayer Times – Cairo*',
      today: (d) => `📅 *${d}*`,
      lines: (t) =>
        `🌅 Fajr: ${t.Fajr}\n` +
        `☀️ Sunrise: ${t.Sunrise}\n` +
        `🕛 Dhuhr: ${t.Dhuhr}\n` +
        `🕒 Asr: ${t.Asr}\n` +
        `🌇 Maghrib: ${t.Maghrib}\n` +
        `🌙 Isha: ${t.Isha}`,
      footer: '🤲 May Allah accept your prayers.',
      fail: '⚠️ Could not fetch prayer times right now. Please try again later.'
    },
    ar: {
      title: '🕌 *مواقيت الصلاة – القاهرة*',
      today: (d) => `📅 *${d}*`,
      lines: (t) =>
        `🌅 الفجر: ${t.Fajr}\n` +
        `☀️ الشروق: ${t.Sunrise}\n` +
        `🕛 الظهر: ${t.Dhuhr}\n` +
        `🕒 العصر: ${t.Asr}\n` +
        `🌇 المغرب: ${t.Maghrib}\n` +
        `🌙 العشاء: ${t.Isha}`,
      footer: '🤲 ربنا يجعلها في ميزان حسناتك.',
      fail: '⚠️ السيرفر مش قادر يجيب المواقيت دلوقتي… جرّب كمان شوية.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    let timings;
    let date;

    try {
      const res = await axios.get('https://muslimsalat.com/cairo.json', { timeout: 7000 });
      const d = res.data;

      timings = {
        Fajr: d.items?.[0]?.fajr,
        Dhuhr: d.items?.[0]?.dhuhr,
        Asr: d.items?.[0]?.asr,
        Maghrib: d.items?.[0]?.maghrib,
        Isha: d.items?.[0]?.isha,
        Sunrise: d.items?.[0]?.shurooq
      };

      date = d.items?.[0]?.date_for;
    } catch {
      const res = await axios.get(
        'https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5',
        { timeout: 7000 }
      );

      const d = res.data?.data;

      timings = {
        Fajr: d?.timings?.Fajr,
        Sunrise: d?.timings?.Sunrise,
        Dhuhr: d?.timings?.Dhuhr,
        Asr: d?.timings?.Asr,
        Maghrib: d?.timings?.Maghrib,
        Isha: d?.timings?.Isha
      };

      date = d?.date?.readable;
    }

    if (
      !timings ||
      !timings.Fajr ||
      !timings.Dhuhr ||
      !timings.Asr ||
      !timings.Maghrib ||
      !timings.Isha ||
      !timings.Sunrise ||
      !date
    ) {
      return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
    }

    const text =
      `${T.title}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `${T.today(date)}\n\n` +
      `${T.lines(timings)}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `${T.footer}`;

    return await sock.sendMessage(chatId, { text }, { quoted: message });
  } catch (err) {
    console.error('PRAY ERROR:', err);
    return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'pray',
  aliases: ['مواقيت', 'الصلاة'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'عرض مواقيت الصلاة (افتراضي: القاهرة) مع مصدر احتياطي عند فشل المصدر الأساسي',
    en: 'Show prayer times (default: Cairo) with a fallback source if the main source fails'
  },
  emoji: '🕋',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: prayCommand
};