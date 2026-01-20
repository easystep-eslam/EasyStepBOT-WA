const axios = require('axios'); // (موجود عندك حتى لو مش مستخدم حالياً)
const { getLang } = require('../../lib/lang');

async function characterCommand(sock, chatId, message) {
  const lang = getLang(chatId);

  const T = {
    needTarget: {
      en: 'Please mention someone or reply to their message to analyze their character!',
      ar: 'من فضلك اعمل منشن لشخص أو رد على رسالته عشان نحلل شخصيته!'
    },
    title: {
      en: '🔮 *Character Analysis* 🔮',
      ar: '🔮 *تحليل الشخصية* 🔮'
    },
    user: {
      en: '👤 *User:*',
      ar: '👤 *المستخدم:*'
    },
    traits: {
      en: '✨ *Key Traits:*',
      ar: '✨ *الصفات الأساسية:*'
    },
    rating: {
      en: '🎯 *Overall Rating:*',
      ar: '🎯 *التقييم العام:*'
    },
    note: {
      en: 'Note: This is a fun analysis and should not be taken seriously!',
      ar: 'ملاحظة: التحليل ده للضحك فقط ومش لازم يتاخد بجدية 😄'
    },
    failed: {
      en: 'Failed to analyze character! Try again later.',
      ar: 'فشل تحليل الشخصية! جرّب تاني بعد شوية.'
    }
  };

  let userToAnalyze;

  // mentioned
  if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
    userToAnalyze = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
  }
  // reply
  else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
    userToAnalyze = message.message.extendedTextMessage.contextInfo.participant;
  }

  if (!userToAnalyze) {
    await sock.sendMessage(chatId, { text: T.needTarget[lang] || T.needTarget.en }, { quoted: message });
    return;
  }

  try {
    // ✅ React مناسب (صح/متعة)
    await sock.sendMessage(chatId, {
      react: { text: '🔮', key: message.key }
    }).catch(() => {});

    // profile picture
    let profilePic;
    try {
      profilePic = await sock.profilePictureUrl(userToAnalyze, 'image');
    } catch {
      profilePic = 'https://i.imgur.com/2wzGhpF.jpeg';
    }

    // Traits EN + AR (اختيار حسب اللغة)
    const traitsEN = [
      "Intelligent", "Creative", "Determined", "Ambitious", "Caring",
      "Charismatic", "Confident", "Empathetic", "Energetic", "Friendly",
      "Generous", "Honest", "Humorous", "Imaginative", "Independent",
      "Intuitive", "Kind", "Logical", "Loyal", "Optimistic",
      "Passionate", "Patient", "Persistent", "Reliable", "Resourceful",
      "Sincere", "Thoughtful", "Understanding", "Versatile", "Wise"
    ];

    const traitsAR = [
      "ذكي", "مبدع", "مصمم", "طموح", "حنون",
      "كاريزما", "واثق", "متفهم", "نشيط", "ودود",
      "كريم", "صادق", "خفيف دم", "خيالي", "مستقل",
      "حدسي", "طيب", "منطقي", "وفي", "متفائل",
      "شغوف", "صبور", "مثابر", "يمكن الاعتماد عليه", "ذو حلول",
      "مخلص", "مراعي", "متفهم", "متعدد المواهب", "حكيم"
    ];

    const traits = (lang === 'ar') ? traitsAR : traitsEN;

    // 3-5 traits
    const numTraits = Math.floor(Math.random() * 3) + 3;
    const selectedTraits = [];
    for (let i = 0; i < numTraits; i++) {
      const randomTrait = traits[Math.floor(Math.random() * traits.length)];
      if (!selectedTraits.includes(randomTrait)) selectedTraits.push(randomTrait);
    }

    const traitPercentages = selectedTraits.map(trait => {
      const percentage = Math.floor(Math.random() * 41) + 60;
      return `${trait}: ${percentage}%`;
    });

    const overall = Math.floor(Math.random() * 21) + 80;

    const analysis =
      `${T.title[lang] || T.title.en}\n\n` +
      `${T.user[lang] || T.user.en} ${userToAnalyze.split('@')[0]}\n\n` +
      `${T.traits[lang] || T.traits.en}\n${traitPercentages.join('\n')}\n\n` +
      `${T.rating[lang] || T.rating.en} ${overall}%\n\n` +
      `${T.note[lang] || T.note.en}`;

    await sock.sendMessage(
      chatId,
      {
        image: { url: profilePic },
        caption: analysis,
        mentions: [userToAnalyze]
      },
      { quoted: message }
    );

  } catch (error) {
    console.error('Error in character command:', error);
    await sock.sendMessage(chatId, { text: T.failed[lang] || T.failed.en }, { quoted: message });
  }
}

/* ✅ Wrappers عشان يشتغل مع أي أوتولودر (chatId من message) */
async function characterExec(sock, message) {
  const chatId = message.key.remoteJid;
  return characterCommand(sock, chatId, message);
}

module.exports = {
  // ✅ metadata (آخر الملف) + بدون ما نشيل أي حاجة من اللي كانت عندك

  name: 'character',

  // ✅ أضفنا Aliases بدون نقطة (والقديمة بالنقطة لسه موجودة زي ما هي)
  aliases: [
    '.character', '.شخصية', '.تحليل_شخصية',
    'character', 'شخصية', 'تحليل_شخصية'
  ],

  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },

  description: {
    ar: 'تحليل شخصية شخص (عشوائي) عن طريق المنشن أو الرد على رسالته.',
    en: 'Analyze someone’s character (random) by mention or replying to their message.'
  },

  usage: {
    ar: 'اعمل منشن لشخص أو رد على رسالته واكتب: character / .character',
    en: 'Mention someone or reply to their message then type: character / .character'
  },
emoji: '🔮',

  admin: false,
  owner: false,
  showInMenu: true,

  // runners
  run: characterExec,
  exec: characterExec,
  execute: characterExec,

  // ✅ للتوافق (زي ما كان)
  characterCommand
};