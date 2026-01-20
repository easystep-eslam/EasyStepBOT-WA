const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

const ROSE_DAY_AR = [
  "🌹 وردة ليكم علشان وجودكم في حياتنا فرق كتير 💖",
  "🌹 كل وردة في الدنيا مش كفاية تعبر عن اللي جوانا ليكم",
  "🌹 في Rose Day حابين نقول لكم إنكم أحلى حاجة حصلت لنا",
  "🌹 وردة بسيطة… بس معناها كبير قوي 🌸",
  "🌹 زي الورد كده… وجودكم دايمًا مفرّح",
  "🌹 في يوم الورد، حابين نديكم وردة من قلبنا",
  "🌹 الورد بيذبل… بس مكانتكم في قلبنا ثابتة",
  "🌹 وردة عشان تفتكروا إن في ناس بتفتكركم دايمًا",
  "🌹 لو الورد بيتكلم كان قال لكم قد إيه أنتم مميزين",
  "🌹 Rose Day سعيد عليكم 💐",
  "🌹 وردة احترام وتقدير… لأنكم تستاهلوا الخير كله",
  "🌹 يوم ورد سعيد… وقلوبكم دايمًا منوّرة زي الورد",
  "🌹 وردة حب صافي… من غير شروط ولا حسابات",
  "🌹 وردة ومعاها دعوة حلوة… ربنا يسعد أيامكم",
  "🌹 في Rose Day… حابين نهديكم لحظة فرح بسيطة زي الورد",
  "🌹 وردة عشان نقول لكم: أنتم غاليين جدًا",
  "🌹 كل سنة وأنتم طيبين… وقلوبكم مليانة سلام",
  "🌹 وردة من القلب… علشان ناس من القلب",
  "🌹 جمال الورد ما يكملش غير بوجودكم",
  "🌹 يوم الورد فرصة نقول لكم: شكرًا على وجودكم",
  "🌹 وردة لكل حد طيب… ولكل قلب صافي",
  "🌹 وردة ومعاها ابتسامة… لأنكم سبب ابتسامات كتير",
  "🌹 يا رب أيامكم تبقى ورد… وراحة بال",
  "🌹 Rose Day سعيد… ومعاه حب وتقدير كبير ليكم",
  "🌹 وردة واعتزاز… لأنكم تستاهلوا الأحسن",
  "🌹 الورد عنوان للذوق… وأنتم عنوان للطيبة",
  "🌹 وردة سلام… تطبطب على القلوب وتفرّحها",
  "🌹 وردة وامتنان… لكل لحظة حلوة بسببكم",
  "🌹 في يوم الورد… حابين نهديكم كلام يليق بكم",
  "🌹 وردة من غير سبب… لأن محبتكم لوحدها سبب",
  "🌹 يا رب قلوبكم دايمًا مزهرة… زي الورد",
  "🌹 وردة ومعاها أطيب الأمنيات… أيامكم كلها ورد",
  "🌹 Rose Day سعيد… وربنا يديم عليكم الستر والفرح",
  "🌹 الورد بيقول لكم: أنتم جمال الدنيا",
  "🌹 وردة لكل روح جميلة… وجودها نعمة",
  "🌹 وردة بسيطة… علشان ناس عظيمة",
  "🌹 في Rose Day… حابين نقول لكم: أنتم قريبين من القلب",
  "🌹 وردة ودعوة… ربنا يحقق لكم اللي تتمنوه",
  "🌹 وردة وراحة بال… وابتسامة ما تفارقكم",
  "🌹 كل وردة بتشبهكم… في الطيبة والرقي",
  "🌹 وردة حب… تليق بقلوبكم",
  "🌹 يا رب تكون أيامكم كلها ورد… وخير وبركة",
  "🌹 Rose Day سعيد عليكم… ويارب دايمًا بخير",
  "🌹 وردة ومعاها شكر… لأنكم بتضيفوا للحياة معنى",
  "🌹 وردة وتقدير… لأنكم أهل للذوق كله",
  "🌹 الورد رمز… وأنتم أجمل من أي رمز",
  "🌹 وردة ومعاها سلام… لكل حد غالي",
  "🌹 وردة بطيب خاطر… لأنكم تستاهلوا",
  "🌹 Rose Day سعيد… وقلوبكم دايمًا مليانة نور"
];

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch {}
}

async function rosedayCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      failed: '❌ Failed to get Rose Day message. Please try again later!'
    },
    ar: {
      failed: '❌ حصل خطأ وأنا بحاول أجيب رسالة Rose Day 🌹'
    }
  };

  try {
    await react(sock, message, '🌹');

    if (lang === 'ar') {
      const arMsg = ROSE_DAY_AR[Math.floor(Math.random() * ROSE_DAY_AR.length)];
      await sock.sendMessage(chatId, { text: arMsg }, { quoted: message });
      await react(sock, message, '✅');
      return;
    }

    const res = await fetch('https://api.princetechn.com/api/fun/roseday?apikey=prince', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) throw new Error('API_ERROR');

    const json = await res.json();
    const text = json?.result || '🌹 Happy Rose Day!';

    await sock.sendMessage(chatId, { text }, { quoted: message });
    await react(sock, message, '✅');
  } catch (err) {
    console.error('roseday error:', err?.message || err);
    await react(sock, message, '❌');
    await sock.sendMessage(chatId, { text: (TXT[lang] || TXT.en).failed }, { quoted: message });
  }
}

module.exports = {
  name: 'roseday',
  aliases: ['roseday', 'rose', 'rose-day', 'ورد', 'يوم_الورد'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  description: {
    ar: 'يرسل رسالة Rose Day عشوائية حسب لغة الجروب.',
    en: 'Send a random Rose Day message based on group language.'
  },
  usage: {
    ar: '.roseday',
    en: '.roseday'
  },
  emoji: '💐',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: rosedayCommand,
  run: rosedayCommand,
  execute: rosedayCommand
};