const { getLang } = require('../../lib/lang');

const roasts_en = [
  "I respect your confidence… even when it’s completely misplaced 😄",
  "You’re like Wi-Fi… you disappear exactly when needed most 📶",
  "You have main-character energy… in a side-quest kind of way 🎭",
  "You talk a lot for someone who’s buffering internally ⏳",
  "You’re not late… you’re just fashionably delayed 🕒",
  "If motivation was a person, it wouldn’t be you today 😅",
  "You’re the human version of ‘I’ll do it tomorrow’ 📅",
  "You’ve got big ideas… and zero follow-through (respect) 🤝",
  "You’re proof that multitasking is just doing many things badly 😂",
  "You’re built different… not sure how, but different 🤷‍♂️",
  "Your brain has two modes: sleep and loading… mostly loading 💤",
  "You bring chaos to ‘organized’ like it’s a sport 🏆",
  "You’re not messy… you’re ‘creatively unstructured’ 🎨",
  "You’re the reason ‘Are you sure?’ exists ✅❌",
  "You make simple things look like a boss fight 🎮",
  "You’re a walking reminder that effort is optional 😭",
  "You have the energy of a Monday morning alarm ⏰",
  "You’re the CEO of procrastination… congrats 📈",
  "Your plans are legendary… in theory 🗺️",
  "You’re like a tutorial… ignored but somehow still loud 📢",
  "You’re the human version of low battery mode 🔋",
  "You don’t break rules… you bend reality 😌",
  "Your vibe says ‘I tried’… and that’s enough 💀",
  "You’re a mystery… mostly why you did that 🤔",
  "You’re not confused… you’re exploring possibilities 🧭",
  "You turn ‘easy’ into ‘extra’ effortlessly ✨",
  "You’re the plot twist nobody asked for 📚",
  "If focus was currency, you’d be broke 💸",
  "You’re not stubborn… you’re committed to being wrong 😅",
  "You make silence feel like an achievement 🏅",
  "You’re the reason the group needs moderation 🧯",
  "You’re like an update… always late and slightly worse 📦",
  "You have talent… for testing people’s patience 😄",
  "You’re a vibe… a confusing one, but still a vibe 🥴",
  "You’re not unlucky… you’re just consistent 🎯",
  "You’re the definition of ‘close enough’ 📏",
  "You could trip on a flat floor and still blame gravity 🌍",
  "Your decisions are like pop-ups… unexpected and annoying 🪟",
  "You’re not a problem… you’re a whole side mission 🧩",
  "You’re like a meme… funny, but concerning 🤨",
  "You’re proof that confidence doesn’t need evidence 🧾",
  "You don’t overthink… you underthink with passion 🔥",
  "You’re the ‘Before’ photo in every transformation 😭",
  "You’re the type to lose a fight with autocorrect ✍️",
  "You bring ‘almost’ to everything you do 🫠",
  "You’re a masterpiece… unfinished 🖼️",
  "You’re the human equivalent of a typo 🫢",
  "You have the attention span of a notification 🔔",
  "Your logic is on vacation… permanently 🏝️",
  "You don’t make mistakes… you create experiences 🎢"
];

const roasts_ar = [
  "أحترم ثقتك… حتى وهي في الاتجاه الغلط 😄",
  "إنت زي الواي فاي… بتختفي وقت اللزوم بالظبط 📶",
  "عندك طاقة بطل… بس في مهمة جانبية 🎭",
  "بتتكلم كتير… وعقلك عامل Buffering ⏳",
  "إنت مش متأخر… إنت بس بتوصل “بطريقتك” 🕒",
  "لو الكسل شخص… كان هيبقى شبهك النهارده 😅",
  "إنت النسخة البشرية من “بكرة إن شاء الله” 📅",
  "أفكارك كبيرة… والتنفيذ في إجازة 🤝",
  "إنت دليل إن تعدد المهام = غلطات كتير 😂",
  "إنت مختلف… ومش عارف ده ميزة ولا اختبار 🤷‍♂️",
  "دماغك ليها وضعين: نوم… وبيحمّل 💤",
  "إنت بتدخل الفوضى في التنظيم كأنه رياضة 🏆",
  "إنت مش فوضوي… إنت ‘إبداع غير منظم’ 🎨",
  "إنت السبب في وجود سؤال: ‘متأكد؟’ ✅❌",
  "بتحوّل الحاجة السهلة لمعركة بوس 🎮",
  "إنت ما بتتعبش… إنت بتستسهل باحتراف 😭",
  "طاقة حضورك زي منبّه يوم الاتنين ⏰",
  "إنت المدير التنفيذي للتسويف… مبروك 📈",
  "خططك أسطورية… بس على الورق 🗺️",
  "إنت زي الشرح… محدش بيقراه بس صوته عالي 📢",
  "إنت النسخة البشرية من وضع توفير البطارية 🔋",
  "إنت ما بتكسرش القواعد… إنت بتثني الواقع 😌",
  "هالتك بتقول ‘حاولت’… وخلاص كده 💀",
  "إنت لغز… خصوصًا ليه عملت كده 🤔",
  "إنت مش محتار… إنت بتستكشف احتمالات 🧭",
  "بتحوّل ‘سهل’ لـ ‘زيادة’ بدون مجهود ✨",
  "إنت التويست اللي محدش طلبه 📚",
  "لو التركيز فلوس… إنت مفلس 💸",
  "إنت مش عنيد… إنت ملتزم بالغلط 😅",
  "السكوت عندك إنجاز 🏅",
  "إنت سبب إن الجروب محتاج تهدئة 🧯",
  "إنت زي تحديث… دايمًا متأخر ومش أحسن حاجة 📦",
  "عندك موهبة… في اختبار صبر الناس 😄",
  "إنت ‘مود’… بس مود مُحيّر 🥴",
  "إنت مش وحش حظ… إنت ثابت على نفس النمط 🎯",
  "إنت تعريف ‘قريبة’ بس مش بالظبط 📏",
  "ممكن تتكعبل في أرض مستوية وتلوم الجاذبية 🌍",
  "قراراتك زي الإعلانات… فجأة ومزعجة 🪟",
  "إنت مش مشكلة… إنت مهمة جانبية كاملة 🧩",
  "إنت زي ميم… مضحك بس مقلق 🤨",
  "إنت دليل إن الثقة مش محتاجة دليل 🧾",
  "إنت ما بتفكرش زيادة… إنت بتفكر ناقص بحماس 🔥",
  "إنت صورة الـ ‘قبل’ في أي تحول 😭",
  "إنت النوع اللي يخسر معركة مع التصحيح التلقائي ✍️",
  "إنت بتضيف ‘تقريبًا’ لكل حاجة 🫠",
  "إنت تحفة… بس لسه مش مكتملة 🖼️",
  "إنت النسخة البشرية من غلطة إملائية 🫢",
  "تركيزك قد إشعار وبيروح 🔔",
  "منطقك مسافر… ومش ناوي يرجع 🏝️",
  "إنت ما بتغلطش… إنت بتعمل تجارب 🎢"
];

function extractTargetJid(message) {
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (Array.isArray(mentioned) && mentioned.length > 0) return mentioned[0];
  const participant = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (participant) return participant;
  return null;
}

async function roastCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const T = {
    needUser: {
      en: '❌ Please mention someone or reply to their message to roast them.',
      ar: '❌ منشن حد أو اعمل Reply على رسالته علشان أبعت روست.'
    },
    failed: {
      en: '❌ Something went wrong. Try again later.',
      ar: '❌ حصلت مشكلة.. جرّب تاني بعد شوية.'
    }
  };

  try {
    await sock.sendMessage(chatId, { react: { text: '🔥', key: message.key } }).catch(() => {});

    const targetJid = extractTargetJid(message);
    if (!targetJid) {
      await sock.sendMessage(chatId, { text: T.needUser[lang] || T.needUser.en }, { quoted: message });
      return;
    }

    const pool = lang === 'ar' ? roasts_ar : roasts_en;
    const roast = pool[Math.floor(Math.random() * pool.length)];

    await sock.sendMessage(
      chatId,
      {
        text: `@${targetJid.split('@')[0]} ${roast}`,
        mentions: [targetJid]
      },
      { quoted: message }
    );

    await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});
  } catch (err) {
    console.error('Error in roast command:', err);
    await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
    await sock.sendMessage(chatId, { text: T.failed[lang] || T.failed.en }, { quoted: message });
  }
}

module.exports = {
  name: 'roast',
  aliases: ['roast', 'سخنها', 'روست'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  emoji: '😈',
  admin: false,
  owner: false,
  showInMenu: true,
  run: roastCommand,
  exec: roastCommand,
  execute: roastCommand,
  roastCommand
};