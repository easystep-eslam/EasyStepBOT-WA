const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang'); // commands/games

const AR_TRUTHS = [
  'قولوا بصراحة… آخر مرة كذبتوا فيها كانت إمتى وليه؟',
  'إيه أكتر حاجة ندمانين عليها لحد دلوقتي؟',
  'مين أكتر شخص بتثقوا فيه في حياتكم وليه؟',
  'إيه سر عمركم ما قلتوه لحد قبل كده؟',
  'لو تقدروا تمسحوا موقف واحد محرج من حياتكم… هيكون إيه؟',
  'إيه أكتر عادة وحشة بتحاولوا تبطلوها؟',
  'إيه أكتر حاجة بتخوفكم في حياتكم؟',
  'مين آخر حد زعلتوه؟ وليه؟',
  'لو قدامكم فرصة تعترفوا بحاجة… هتعترفوا بإيه؟',
  'إيه أكتر حاجة بتغيروا منها؟',
  'هل عمركم حبيتوا حد ومقلتوش؟',
  'إيه أكبر غلط عملتوه واتعلمتوا منه؟',
  'إيه أكتر موقف خلاكم تعيطوا بجد؟',
  'لو حد عرف عنكم حاجة ممكن تغيّر صورته عنكم… هتكون إيه؟',
  'إيه أكتر حاجة بتكرهواها في نفسكم؟',
  'إيه أكتر حاجة بتحبوها في نفسكم؟',
  'هل عمركم اتظاهرتوا إنكم مبسوطين وانتوا من جواكم تعبانين؟',
  'مين الشخص اللي نفسكم ترجعوا له الزمن وتصلّحوا اللي بينكم؟',
  'إيه أكتر حلم نفسكم يتحقق قريب؟',
  'لو تقدروا تغيروا صفة واحدة في شخصيتكم… هتغيروا إيه؟',
  'إيه أكتر قرار خدّتوه وغيّر حياتكم؟',
  'إيه أكتر حاجة بتتمنّوا الناس تفهمها عنكم؟',
  'إمتى آخر مرة قلتوا فيها «أنا مش تمام» لنفسكم؟',
  'إيه أكتر موقف حسّيتوا فيه بالخذلان؟',
  'إيه أكتر حاجة بتخليكم تحسّوا بالأمان؟',
  'لو تقدروا تقولوا كلمة واحدة لنفسكم في الماضي… هتقولوا إيه؟',
  'إيه أكتر حاجة بتتعبكم نفسياً الفترة دي؟',
  'مين الشخص اللي بتفتقدوه حتى لو مش بتتكلموا؟',
  'إيه أكتر حاجة بتخافوا تخسروها؟',
  'إيه موقف تتمنّوا تعيدوه بشكل مختلف؟',
  'إيه أكتر وعد قطعتوه على نفسكم ولسه محققتوهوش؟',
  'إيه أكتر حاجة بتزعلوا إنكم مش قادرين تعبّروا عنها؟',
  'هل في شخص سامحتوه ظاهرياً ولسه من جواكم متضايقين؟',
  'إيه أكتر حاجة بتتمنّوا تتغير في حياتكم السنة دي؟',
  'إيه أكتر ذكرى بتوجعكم لما تفتكروها؟',
  'إيه أكتر حاجة بتخليكم تحسّوا بالفخر بنفسكم؟',
  'مين الشخص اللي شايفينه قدوة حقيقية؟ وليه؟',
  'لو قدامكم فرصة تبدأوا من جديد… هتسيبوا إيه وراكم؟',
  'إيه أكتر حاجة بتحسّوا فيها بالذنب؟',
  'هل في كلام نفسكم تقولوه لحد ومش قادرين؟'
];

const EN_TRUTHS = [
  'What’s the last lie you told and why?',
  'What is something you regret doing the most?',
  'Who do you trust the most and why?',
  'What secret have you never told anyone?',
  'What’s your most embarrassing moment?',
  'What bad habit are you trying to quit?',
  'What scares you the most in life?',
  'Who was the last person you hurt and why?',
  'If you could confess something today, what would it be?',
  'What are you most jealous of?',
  'Have you ever liked someone and never told them?',
  'What is the biggest mistake you learned from?',
  'When was the last time you truly cried?',
  'What is something about you that could change how people see you?',
  'What do you dislike most about yourself?',
  'What do you like most about yourself?',
  'Have you ever pretended to be okay while you weren’t?',
  'Who do you miss even if you don’t talk anymore?',
  'What’s a dream you want to achieve soon?',
  'If you could change one trait in yourself, what would it be?',
  'What decision changed your life the most?',
  'What do you wish people understood about you?',
  'When was the last time you admitted “I’m not okay” to yourself?',
  'What’s the biggest betrayal you’ve felt?',
  'What makes you feel safe?',
  'If you could tell your past self one word, what would it be?',
  'What has been mentally exhausting for you lately?',
  'What do you fear losing the most?',
  'What moment would you redo differently?',
  'What promise to yourself have you not fulfilled yet?',
  'What’s something you can’t express well?',
  'Have you forgiven someone outwardly but not inside?',
  'What do you hope changes in your life this year?',
  'Which memory hurts the most to recall?',
  'What makes you proud of yourself?',
  'Who is your real-life role model and why?',
  'If you could start over, what would you leave behind?',
  'What do you feel most guilty about?',
  'Is there something you want to say to someone but can’t?',
  'What’s the most awkward thing you’ve ever said?',
  'What’s the biggest insecurity you have?'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function safeSend(sock, chatId, payload, opts) {
  try {
    return await sock.sendMessage(chatId, payload, opts);
  } catch {}
}

async function truthHandler(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      failed: '❌ Failed to get a truth question. Please try again later!'
    },
    ar: {
      failed: '❌ مقدرتش أجيب سؤال حقيقة دلوقتي، جرّب تاني بعد شوية!'
    }
  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '🧩');

  try {
    if (lang === 'ar') {
      const truthMessage = pickRandom(AR_TRUTHS);
      await safeSend(sock, chatId, { text: `🧩 ${truthMessage}` }, { quoted: message });
      return;
    }

    let truthMessage = '';

    try {
      const res = await fetch('https://shizoapi.onrender.com/api/texts/truth?apikey=shizo', {
        method: 'GET',
        headers: { 'User-Agent': 'EasyStep-BOT', Accept: 'application/json' },
        timeout: 15000
      });

      if (res.ok) {
        const json = await res.json();
        truthMessage = String(json?.result || json?.data || json?.text || '').trim();
      }
    } catch {}

    if (!truthMessage) truthMessage = pickRandom(EN_TRUTHS);

    await safeSend(sock, chatId, { text: `🧩 ${truthMessage}` }, { quoted: message });

  } catch (err) {
    console.error('[TRUTH] Error:', err?.message || err);
    await safeSend(sock, chatId, { text: T.failed }, { quoted: message });
  }
}

/* =========  Metadata (must be last)  ========= */

module.exports = {
  name: 'truth',
  aliases: ['truth', 't', 'حقيقة', 'صدق'],
  category: {
    ar: '🎲 ألعاب ترفيهية',
    en: '🎲 Fun Games'
  },
  description: {
    ar: 'يبعت سؤال حقيقة عشوائي (عربي/إنجليزي حسب لغة الجروب).',
    en: 'Send a random truth question (Arabic/English based on group language).'
  },
  usage: {
    ar: '.truth',
    en: '.truth'
  },
  emoji: '🧩',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: truthHandler,
  run: truthHandler,
  execute: truthHandler
};