const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

/*
📝 Command Info
────────────────
Name      : dare
Aliases   : dare , تحدي , جرأة
Category  : Fun Commands | أوامر الترفيه
Use       : dare / .dare
*/

/*
🇸🇦 Arabic dares (local)
تقدر تزود براحتك
*/
const arabicDares = [
  'قول نكتة دلوقتي 😂',
  'ابعت فويس 5 ثواني بتقلد فيه مذيع أخبار 🎙️',
  'اكتب آخر 3 إيموجي عندك من غير ما تشرحهم 😅',
  'قل “أنا جامد” 3 مرات ورا بعض 😎',
  'ابعت صورة لشيء قدامك حالًا 📸',
  'اكتب رسالة شكر لأي حد في الجروب ❤️',
  'اكتب كلمة “موز” وسط كلامك في أول رسالة جاية 🍌',
  'قول رأيك بصراحة في آخر فيلم شوفته 🎬',
  'ابعت “😂😂😂” لأي رسالة فوقك كنوع من الهزار',
  'اعترف بحاجة لطيفة عن نفسك ✨'
];

// helper
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function dareCommand(sock, chatId, message) {
  const lang = getLang(chatId);

  const T = {
    failed: {
      en: '❌ Failed to get a dare. Please try again later!',
      ar: '❌ فشل الحصول على التحدي. جرّب تاني بعد شوية!'
    }
  };

  try {
    // 🧠 React مناسب للأمر
    await sock.sendMessage(chatId, {
      react: { text: '🔥', key: message.key }
    }).catch(() => {});

    // ✅ عربي → تحديات محلية
    if (lang === 'ar') {
      const dareMessage = pickRandom(arabicDares);

      await sock.sendMessage(
        chatId,
        { text: dareMessage },
        { quoted: message }
      );
      return;
    }

    // ✅ إنجليزي → API
    const res = await fetch(
      'https://shizoapi.onrender.com/api/texts/dare?apikey=shizo',
      { timeout: 15000 }
    );

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = await res.json();
    const dareMessage = json?.result;

    if (!dareMessage) {
      throw new Error('No dare returned');
    }

    await sock.sendMessage(
      chatId,
      { text: dareMessage },
      { quoted: message }
    );

  } catch (error) {
    console.error('[DARE]', error);

    // ❌ React فشل
    try {
      await sock.sendMessage(chatId, {
        react: { text: '❌', key: message.key }
      }).catch(() => {});
    } catch {}

    await sock.sendMessage(
      chatId,
      { text: T.failed[lang] || T.failed.en },
      { quoted: message }
    );
  }
}

/*
✅ Wrapper عشان الأوتولودر
*/
async function dareExec(sock, message) {
  const chatId = message.key.remoteJid;
  return dareCommand(sock, chatId, message);
}

module.exports = {
  // ✅ metadata في الآخر (القاعدة الذهبية)

  name: 'dare',

  aliases: [
    '.dare', '.تحدي', '.جرأة',
    'dare', 'تحدي', 'جرأة'
  ],

  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },

  description: {
    ar: 'يرسل تحدي (جرأة) عشوائي حسب لغة الجروب.',
    en: 'Send a random dare based on group language.'
  },

  usage: {
    ar: 'اكتب: dare / .dare',
    en: 'Type: dare / .dare'
  },
emoji: '🛰',

  admin: false,
  owner: false,
  showInMenu: true,

  // runners
  run: dareExec,
  exec: dareExec,
  execute: dareExec,

  // توافق قديم
  dareCommand
};