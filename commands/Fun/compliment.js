const { getLang } = require('../../lib/lang');

const compliments = {
  en: [
    "You're amazing just the way you are!",
    "You have a great sense of humor!",
    "You're incredibly thoughtful and kind.",
    "You are more powerful than you know.",
    "You light up the room!",
    "You're a true friend.",
    "You inspire me!",
    "Your creativity knows no bounds!",
    "You have a heart of gold.",
    "You make a difference in the world.",
    "Your positivity is contagious!",
    "You have an incredible work ethic.",
    "You bring out the best in people.",
    "Your smile brightens everyone's day.",
    "You're so talented in everything you do.",
    "Your kindness makes the world a better place.",
    "You have a unique and wonderful perspective.",
    "Your enthusiasm is truly inspiring!",
    "You are capable of achieving great things.",
    "You always know how to make someone feel special.",
    "Your confidence is admirable.",
    "You have a beautiful soul.",
    "Your generosity knows no limits.",
    "You have a great eye for detail.",
    "Your passion is truly motivating!",
    "You are an amazing listener.",
    "You're stronger than you think!",
    "Your laughter is infectious.",
    "You have a natural gift for making others feel valued.",
    "You make the world a better place just by being in it."
  ],
  ar: [
    "أنت رائع/ة زي ما أنت/ِ!",
    "عندك حس فكاهي جميل!",
    "أنت شخص لطيف وحنون جدًا.",
    "أنت أقوى مما تتخيل!",
    "وجودك بينور المكان!",
    "أنت صديق/ة بجد.",
    "أنت مُلهم/ة!",
    "إبداعك ملوش حدود!",
    "قلبك دهب!",
    "أنت بتعمل فرق في العالم.",
    "إيجابيتك بتعدي اللي حواليك!",
    "عندك أخلاق شغل عالية جدًا.",
    "بتطلع أحسن ما في الناس.",
    "ابتسامتك بتفرّح أي حد.",
    "موهوب/ة في اللي بتعمله.",
    "طيبتك بتخلّي الدنيا أحسن.",
    "نظرتك للحياة مميزة وجميلة.",
    "حماسك مُلهم فعلًا!",
    "تقدر تحقق حاجات عظيمة.",
    "دايمًا بتخلي الناس تحس إنها مهمة.",
    "ثقتك في نفسك حاجة تُحترم.",
    "روحك جميلة.",
    "كرمك ملوش حدود.",
    "عينك للتفاصيل قوية.",
    "شغفك بيحفّز اللي حواليك!",
    "أنت مستمع/ة رائع/ة.",
    "أنت أقوى مما تظن!",
    "ضحكتك بتعدي!",
    "عندك موهبة تخلي الناس تحس بالتقدير.",
    "الدنيا أحسن بوجودك."
  ]
};

/*
📝 Command Info
────────────────
Name      : compliment
Aliases   : compliment , مجاملة , مدح
Category  : Fun Commands | أوامر الترفيه
Use       : mention someone or reply then type: compliment
*/

async function complimentCommand(sock, chatId, message) {
  try {
    if (!message || !chatId) {
      console.log('Invalid message or chatId:', { message, chatId });
      return;
    }

    const lang = getLang(chatId);

    const T = {
      needUser: {
        en: 'Please mention someone or reply to their message to compliment them!',
        ar: 'من فضلك اعمل منشن لشخص أو رد على رسالته علشان تمدحه!'
      },
      tryAgain: {
        en: 'Please try again in a few seconds.',
        ar: 'جرّب تاني بعد كام ثانية.'
      },
      error: {
        en: 'An error occurred while sending the compliment.',
        ar: 'حصل خطأ أثناء إرسال المجاملة.'
      }
    };

    let userToCompliment;

    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      userToCompliment = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
      userToCompliment = message.message.extendedTextMessage.contextInfo.participant;
    }

    if (!userToCompliment) {
      await sock.sendMessage(chatId, { text: T.needUser[lang] || T.needUser.en }, { quoted: message });
      return;
    }

    // ✅ React مناسب للأمر
    await sock.sendMessage(chatId, {
      react: { text: '💛', key: message.key }
    }).catch(() => {});

    const list = compliments[lang] || compliments.en;
    const compliment = list[Math.floor(Math.random() * list.length)];

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mentionName = `@${userToCompliment.split('@')[0]}`;

    await sock.sendMessage(
      chatId,
      {
        text:
          lang === 'ar'
            ? `يا ${mentionName}، ${compliment}`
            : `Hey ${mentionName}, ${compliment}`,
        mentions: [userToCompliment]
      },
      { quoted: message }
    );
  } catch (error) {
    console.error('Error in compliment command:', error);

    // ✅ React فشل
    try {
      await sock.sendMessage(chatId, {
        react: { text: '❌', key: message.key }
      }).catch(() => {});
    } catch {}

    // Keep same logic, just bilingual replies
    try {
      const lang = getLang(chatId);
      if (error?.data === 429) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sock.sendMessage(
          chatId,
          { text: (lang === 'ar' ? 'جرّب تاني بعد كام ثانية.' : 'Please try again in a few seconds.') },
          { quoted: message }
        );
      } else {
        await sock.sendMessage(
          chatId,
          { text: (lang === 'ar' ? 'حصل خطأ أثناء إرسال المجاملة.' : 'An error occurred while sending the compliment.') },
          { quoted: message }
        );
      }
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
  }
}

/* ✅ Wrapper عشان يشتغل مع أي أوتولودر (chatId من message) */
async function complimentExec(sock, message) {
  const chatId = message.key.remoteJid;
  return complimentCommand(sock, chatId, message);
}

module.exports = {
  // ✅ metadata في الآخر + aliases بدون نقطة (مع الحفاظ على اللي بالنقطة)

  name: 'compliment',

  aliases: [
    '.compliment', '.مجاملة', '.مدح',
    'compliment', 'مجاملة', 'مدح'
  ],

  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },

  description: {
    ar: 'يرسل مجاملة عشوائية لشخص عن طريق المنشن أو الرد على رسالته.',
    en: 'Send a random compliment by mentioning someone or replying to their message.'
  },

  usage: {
    ar: 'اعمل منشن/رد على الشخص واكتب: compliment / .compliment',
    en: 'Mention/reply to someone then type: compliment / .compliment'
  },
emoji: '🧡',

  admin: false,
  owner: false,
  showInMenu: true,

  // runners (دعم exec/run/execute)
  run: complimentExec,
  exec: complimentExec,
  execute: complimentExec,

  // keep old export compatibility
  complimentCommand
};