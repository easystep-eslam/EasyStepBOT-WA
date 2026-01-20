const { getLang } = require('../../lib/lang');

/*
📝 Command Info
────────────────
Name      : 8ball
Aliases   : 8ball , eightball , حظ , كرة_الحظ
Category  : Fun Commands | أوامر الترفيه
Use       : .8ball <question>
*/

/*
🎱 Possible responses
*/
const eightBallResponses = {
  en: [
    "Yes, definitely!",
    "No way!",
    "Ask again later.",
    "It is certain.",
    "Very doubtful.",
    "Without a doubt.",
    "My reply is no.",
    "Signs point to yes.",
    "Most likely.",
    "Outlook not so good.",
    "Absolutely!",
    "I wouldn’t count on it.",
    "Chances are high.",
    "Chances are low.",
    "The answer is unclear.",
    "Trust your instincts.",
    "Better not tell you now.",
    "It may surprise you.",
    "All signs say yes.",
    "All signs say no.",
    "There is hope.",
    "Not in the near future.",
    "Yes… but be careful.",
    "No… but things can change.",
    "The universe says yes.",
    "The universe says no.",
    "Focus and ask again.",
    "Luck is on your side.",
    "Don’t rush the answer.",
    "Time will tell."
  ],

  ar: [
    "نعم، بالتأكيد!",
    "مستحيل!",
    "اسأل مرة تانية بعدين.",
    "أكيد.",
    "الاحتمال ضعيف جدًا.",
    "من غير أي شك.",
    "إجابتي لا.",
    "العلامات بتقول نعم.",
    "الأغلب نعم.",
    "الوضع مش مبشّر.",
    "طبعًا!",
    "مش متأكد بصراحة.",
    "الحظ في صفك.",
    "الحظ مش مساعدك.",
    "الإجابة مش واضحة دلوقتي.",
    "اتبع إحساسك.",
    "مش وقتها تعرف.",
    "الإجابة ممكن تفاجئك.",
    "كل الدلائل بتقول نعم.",
    "كل الدلائل بتقول لا.",
    "في أمل.",
    "مش قريب.",
    "نعم… بس خليك حذر.",
    "لا… بس كل شيء بيتغير.",
    "القدر بيقول نعم.",
    "القدر بيقول لا.",
    "ركّز واسأل تاني.",
    "استنى شوية.",
    "الوقت كفيل بالإجابة.",
    "ربنا أعلم."
  ]
};

/*
🎯 Main command logic
*/
async function eightBallCommand(sock, chatId, message, args = []) {
  const lang = getLang(chatId);

  const T = {
    needQuestion: {
      en: '❓ Please ask a question first.\nExample: .8ball Will I be rich?',
      ar: '❓ اسأل سؤال الأول.\nمثال: .8ball هل هبقى غني؟'
    }
  };

  const question = Array.isArray(args) ? args.join(' ').trim() : '';

  // ❌ لو مفيش سؤال
  if (!question) {
    await sock.sendMessage(
      chatId,
      { text: T.needQuestion[lang] || T.needQuestion.en },
      { quoted: message }
    );
    return;
  }

  try {
    // 🎱 React مناسب
    await sock.sendMessage(chatId, {
      react: { text: '🎱', key: message.key }
    }).catch(() => {});

    const responses = eightBallResponses[lang] || eightBallResponses.en;
    const randomResponse =
      responses[Math.floor(Math.random() * responses.length)];

    await sock.sendMessage(
      chatId,
      { text: `🎱 ${randomResponse}` },
      { quoted: message }
    );

  } catch (err) {
    console.error('[8BALL]', err);
  }
}

/*
✅ Wrapper للأوتولودر
*/
async function eightBallExec(sock, message, args) {
  const chatId = message.key.remoteJid;
  return eightBallCommand(sock, chatId, message, args);
}

module.exports = {
  // ✅ القاعدة الذهبية: metadata في الآخر

  name: '8ball',

  aliases: [
    '.8ball', '.eightball', '.حظ', '.كرة_الحظ',
    '8ball', 'eightball', 'حظ', 'كرة_الحظ'
  ],

  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },

  description: {
    ar: 'اسأل سؤال والبوت يجاوبك بإجابة عشوائية.',
    en: 'Ask a question and get a random answer.'
  },

  usage: {
    ar: '.8ball <سؤالك>',
    en: '.8ball <your question>'
  },
emoji:'🎱',

  admin: false,
  owner: false,
  showInMenu: true,

  // runners
  run: eightBallExec,
  exec: eightBallExec,
  execute: eightBallExec,

  // توافق قديم
  eightBallCommand
};