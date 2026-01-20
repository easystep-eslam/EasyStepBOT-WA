const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

/*
📝 Command Info
────────────────
Name      : flirt
Description:
• Sends a random flirt / romantic message
• Arabic → local messages
• English → API
*/

// 💖 غزل عربي محلي (عدد كبير)
const arabicFlirts = [
  'عيونك كفاية تغيّر مود يوم كامل ❤️',
  'إنت مش محتاج تقول حاجة… وجودك لوحده كفاية 😌',
  'القلب لما شافك قال: خلاص أنا استقريت 😉',
  'إنت السبب إن الابتسامة بتيجي لوحدها 😊',
  'لو الجمال شخص، هيبقى باسمك 😍',
  'في ناس presence بتفرق… وإنت منهم ✨',
  'هو في حد كده ولا ده استثناء؟ 👀❤️',
  'إنت الحاجات الحلوة اللي بتيجي من غير مقدمات 💫',
  'إنت نوع الناس اللي القلب بيرتاحلها من أول مرة 💖',
  'في كلام كتير يتقال… بس وجودك بيغني عن كل ده 😌',
  'إنت مش بس جميل… إنت مريح كمان ❤️',
  'الصدفة الوحيدة اللي طلعت حلوة بجد هي إنك موجود ✨',
  'إنت من الحاجات اللي ربنا بيحبّب فيها خلقه 💙',
  'القلب لما شافك قال: تمام، كفاية كده 🫶',
  'هو في حد يتشاف ويتحب في نفس اللحظة؟ آه… إنت 😍',
  'إنت راحة، مش شخص وبس 🌸',
  'وجودك في المكان بيخلّيه أهدى وأحلى ✨',
  'إنت التفاصيل الحلوة اللي مبتتقالش ✨',
  'القلب مش محتاج سبب عشان يحبك ❤️',
  'إنت من الناس اللي الواحد يحب يشوفهم دايمًا 😊',
  'إنت طبطبة من غير ما تتكلم 🤍',
  'في ناس قريبة من القلب من غير أي مجهود… وإنت منهم',
  'هو الحُب كده؟ ولا ده أنت؟ 👀❤️',
  'القلب لما شافك قال: أنا تمام كده 😌',
  'إنت مش مجرد شخص… إنت إحساس 💫'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function flirtCommand(sock, chatId, message) {
  const lang = getLang(chatId);

  const T = {
    failed: {
      en: '❌ Failed to get flirt message. Please try again later!',
      ar: '❌ مقدرتش أجيب جملة غزل دلوقتي، جرّب تاني بعد شوية!'
    }
  };

  try {
    // 💖 React مناسب
    await sock.sendMessage(chatId, {
      react: { text: '💖', key: message.key }
    }).catch(() => {});

    // 🇸🇦 عربي → غزل محلي
    if (lang === 'ar') {
      const flirt = pickRandom(arabicFlirts);
      await sock.sendMessage(
        chatId,
        { text: flirt },
        { quoted: message }
      );
      return;
    }

    // 🇺🇸 إنجليزي → API
    const shizokeys = 'shizo';
    const res = await fetch(
      `https://shizoapi.onrender.com/api/texts/flirt?apikey=${shizokeys}`
    );

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = await res.json();
    const flirtMessage = json?.result;

    if (!flirtMessage) {
      throw new Error('No flirt message returned');
    }

    await sock.sendMessage(
      chatId,
      { text: flirtMessage },
      { quoted: message }
    );

  } catch (error) {
    console.error('[FLIRT]', error);

    await sock.sendMessage(
      chatId,
      { text: T.failed[lang] || T.failed.en },
      { quoted: message }
    );
  }
}

/*
✅ Wrapper للأوتولودر
*/
async function flirtExec(sock, message) {
  const chatId = message.key.remoteJid;
  return flirtCommand(sock, chatId, message);
}

module.exports = {
  // ✅ القاعدة الذهبية: metadata في الآخر

  name: 'flirt',

  aliases: [
    '.flirt', '.غزل', '.كلام_غزل',
    'flirt', 'غزل', 'كلام_غزل'
  ],

  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },

  description: {
    ar: 'يرسل جملة غزل أو كلام لطيف عشوائي.',
    en: 'Send a random flirt or romantic message.'
  },

  usage: {
    ar: '.flirt',
    en: '.flirt'
  },
emoji: '💕',

  admin: false,
  owner: false,
  showInMenu: true,

  // runners
  run: flirtExec,
  exec: flirtExec,
  execute: flirtExec,

  // توافق قديم
  flirtCommand
};