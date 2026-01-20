const axios = require('axios');
const { getLang } = require('../../lib/lang');

const arabicFacts = [
  'العسل هو الطعام الوحيد الذي لا يفسد أبدًا.',
  'الأخطبوط عنده 3 قلوب.',
  'الإنسان يقضي تقريبًا ثلث عمره نائم.',
  'الزرافة لا تصدر أي صوت تقريبًا.',
  'المخ البشري يستهلك حوالي 20٪ من طاقة الجسم.',
  'القطط بتقضي حوالي 70٪ من حياتها نوم.',
  'قلب الإنسان ينبض أكثر من 100 ألف مرة في اليوم.',
  'الطيور ما بتبولش، كلها فضلاتها بتطلع مرة واحدة.',
  'العين تقدر تميّز حوالي 10 مليون لون.',
  'السمك بيشرب مياه، بس بطرق مختلفة حسب نوعه.',
  'الدماغ لا يشعر بالألم رغم إنه مركز الإحساس.',
  'بصمة اللسان فريدة زي بصمة الإصبع.',
  'القمر بيبعد عن الأرض حوالي 3.8 سم كل سنة.',
  'الإنسان بيضحك في المتوسط 15 مرة في اليوم.',
  'المعدة بتغير بطانتها كل 3 أيام تقريبًا.',
  'العظام أقوى من الحديد بالنسبة لوزنها.',
  'الأنف يقدر يميّز أكتر من تريليون رائحة.',
  'الضوء من الشمس بياخد حوالي 8 دقائق عشان يوصل للأرض.',
  'سمك القرش موجود قبل الديناصورات.',
  'القلب يضخ دم يكفي لملء حمام سباحة خلال العمر.',
  'النحل لازم يزور حوالي 2 مليون زهرة لإنتاج نصف كيلو عسل.',
  'الأذن بتفضل تنمو طول العمر.',
  'الإنسان أقرب جينيًا للموز مما تتخيل.',
  'الماء الساخن ممكن يتجمد أسرع من البارد أحيانًا.',
  'عدد النجوم في الكون أكبر من عدد حبات الرمل على الأرض.'
];

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function factCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      error: '❌ Sorry, I could not fetch a fact right now.'
    },
    ar: {
      error: '❌ آسف، مقدرتش أجيب معلومة دلوقتي.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await safeReact(sock, chatId, message.key, '🧠');

    if (lang === 'ar') {
      const fact = arabicFacts[Math.floor(Math.random() * arabicFacts.length)];
      await sock.sendMessage(chatId, { text: `🧠 ${fact}` }, { quoted: message });
      await safeReact(sock, chatId, message.key, '✨');
      return;
    }

    const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', {
      timeout: 15000
    });

    const fact = response.data?.text;
    if (!fact) throw new Error('No fact');

    await sock.sendMessage(chatId, { text: `🧠 ${fact}` }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✨');
  } catch (e) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'fact',

  aliases: ['fact', 'معلومة', 'حقائق'],

  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },

  description: {
    ar: 'إرسال معلومة عشوائية (عربي من قائمة محلية / إنجليزي من API).',
    en: 'Send a random fact (Arabic from local list / English from API).'
  },

  usage: {
    ar: '.fact',
    en: '.fact'
  },
emoji: '💡',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: factCommand,
  run: factCommand,
  execute: (sock, message, args) => factCommand(sock, message, args)
};