const axios = require('axios');
const { getLang } = require('../../lib/lang');

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDiff(target) {
  const now = new Date();
  const diffMs = target - now;
  if (diffMs <= 0) return { days: 0, hours: 0 };

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return { days, hours };
}

async function ramadanCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '🌙', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      titleBefore: '🌙 Ramadan is coming',
      left: '⏳ Time left:',
      days: 'day(s)',
      hours: 'hour(s)',
      titleIn: '🌙 Ramadan Kareem – Cairo',
      suhoor: '🥣 Suhoor',
      iftar: '🌅 Iftar',
      fail: '❌ Failed to fetch Ramadan data.'
    },
    ar: {
      titleBefore: '🌙 على سبيل الفرحة… رمضان على وصول',
      left: '⏳ باقي من الزمن:',
      days: 'يوم',
      hours: 'ساعة',
      titleIn: '🌙 رمضان كريم – القاهرة',
      suhoor: '🥣 السحور',
      iftar: '🌅 الفطار',
      fail: '❌ حصل خطأ أثناء جلب بيانات رمضان'
    }
  };

  const T = TXT[lang] || TXT.en;

  const duas = {
    en: [
      'May Allah let us reach Ramadan in goodness 🤲',
      'May Allah help us with fasting and prayer 🤍',
      'May Ramadan be a gate of خير for us 🌙',
      'May Allah make us among those freed from Fire 🔥',
      'May Allah accept our deeds 🤲'
    ],
    ar: [
      'اللهم بلغنا رمضان لا فاقدين ولا مفقودين 🤲',
      'اللهم أعنا على الصيام والقيام وغض البصر 🤍',
      'اللهم اجعل رمضان فاتحة خير علينا 🌙',
      'اللهم اجعلنا من عتقائك من النار 🔥',
      'اللهم تقبل منا صالح الأعمال 🤲'
    ]
  };

  const randomDua = pick(duas[lang] || duas.en);

  try {
    const CITY = 'Cairo';
    const COUNTRY = 'Egypt';
    const method = 5;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const greg = `${dd}-${mm}-${yyyy}`;

    const hijriRes = await axios.get(`https://api.aladhan.com/v1/gToH/${greg}`, { timeout: 15000 });
    const hijri = hijriRes?.data?.data?.hijri;

    const currentHijriYear = parseInt(hijri?.year, 10);
    const currentHijriMonth = parseInt(hijri?.month?.number, 10);

    if (!currentHijriYear || !currentHijriMonth) {
      return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
    }

    const ramadanHijriYear = currentHijriMonth <= 9 ? currentHijriYear : currentHijriYear + 1;

    const ramadanStartRes = await axios.get(
      `https://api.aladhan.com/v1/hToG/01-09-${ramadanHijriYear}`,
      { timeout: 15000 }
    );

    const g = ramadanStartRes?.data?.data?.gregorian;
    const gDateStr = g?.date;
    if (!gDateStr) {
      return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
    }

    const [gDD, gMM, gYYYY] = gDateStr.split('-').map((x) => parseInt(x, 10));
    const ramadanStart = new Date(gYYYY, (gMM || 1) - 1, gDD || 1, 0, 0, 0);

    const now = new Date();

    if (now < ramadanStart) {
      const { days, hours } = formatDiff(ramadanStart);

      const text =
        `${T.titleBefore}\n\n` +
        `${T.left}\n` +
        `📅 ${days} ${T.days}\n` +
        `🕒 ${hours} ${T.hours}\n\n` +
        `🤲 ${randomDua}`;

      return await sock.sendMessage(chatId, { text }, { quoted: message });
    }

    const timingsRes = await axios.get(
      `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(CITY)}&country=${encodeURIComponent(COUNTRY)}&method=${method}`,
      { timeout: 15000 }
    );

    const timings = timingsRes?.data?.data?.timings || {};
    const suhoor = timings.Imsak || timings.Fajr || '--:--';
    const iftar = timings.Maghrib || '--:--';

    const text =
      `${T.titleIn}\n\n` +
      `${T.suhoor}: ${suhoor}\n` +
      `${T.iftar}: ${iftar}\n\n` +
      `🤲 ${randomDua}`;

    return await sock.sendMessage(chatId, { text }, { quoted: message });

  } catch (err) {
    console.error('RAMADAN ERROR:', err);
    return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'ramadan',
  aliases: ['رمضان'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'يعرض الوقت المتبقي لرمضان، وفي رمضان يعرض السحور والإفطار (القاهرة)',
    en: 'Shows time left until Ramadan, and during Ramadan shows suhoor/iftar times (Cairo)'
  },
  emoji: '🌙',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: ramadanCommand
};