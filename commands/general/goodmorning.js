const { getLang } = require('../../lib/lang');

async function goodMorningCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      react: '☀️',
      messages: [
        '☀️ Good morning everyone!\n🤲 May your day be blessed and full of goodness.',
        '🌅 Morning vibes!\n🤲 Wishing you success, peace, and رزق واسع.',
        '🌞 A fresh start for a new day.\n🤲 May Allah bless your time and efforts.',
        '✨ Good morning!\n🤲 May your heart be calm and your رزق be abundant.',
        '☕ Good morning!\n🤲 May your day be easy and productive.',
        '🌤️ Rise and shine!\n🤲 May today bring you happiness and success.',
        '🌼 Good morning to all!\n🤲 May Allah open doors of الخير for you.',
        '☀️ New morning, new opportunities.\n🤲 May your steps be guided.',
        '🌞 Good morning!\n🤲 May your work be blessed and your heart content.',
        '✨ Wishing you a peaceful morning and a successful day.',
        '🌤️ Good morning!\n🤲 May Allah put barakah in your وقت and your رزق.',
        '☀️ A bright morning to you all!\n🤲 May your day be filled with ease and smiles.',
        '🌅 Good morning!\n🤲 May Allah grant you clarity, strength, and خير.',
        '🌞 Morning reminder:\n🤲 Start with Bismillah and trust Allah.',
        '☕ Morning coffee & good energy!\n🤲 May your day be smooth and productive.',
        '✨ A calm morning, a blessed day.\n🤲 May Allah protect you and guide you.',
        '🌼 Good morning!\n🤲 May your قلب be light and your mind at peace.',
        '☀️ New day, new mercy.\n🤲 May Allah accept your good deeds today.',
        '🌅 Rise with hope.\n🤲 May Allah open doors you never imagined.',
        '🌞 Good morning everyone!\n🤲 May today be a step closer to your goals.'
      ]
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      react: '☀️',
      messages: [
        '☀️ صباح الخير يا جماعة\n🤲 اللهم ارزقنا رزقًا حلالًا طيبًا واسعًا وبارك لنا فيه',
        '🌅 صباح الفل والياسمين\n🤲 اللهم افتح لنا أبواب رزقك التي لا تُغلق ووسّع علينا من فضلك',
        '☀️ صباح الخير وبداية جميلة\n🤲 اللهم ارزقنا من حيث لا نحتسب واجعل رزقنا مباركًا',
        '🌞 صباح النشاط والهمة\n🤲 اللهم يسّر لنا أرزاقنا وبارك لنا في القليل قبل الكثير',
        '✨ صباح جديد\n🤲 اللهم ارزقنا رزقًا يكفينا ويغنينا',
        '☕ صباح القهوة والمزاج\n🤲 اللهم بارك لنا في يومنا ووقتنا',
        '🌸 صباح الورد\n🤲 اللهم اجعل أيامنا مليئة بالخير والرضا',
        '☀️ صباح التفاؤل\n🤲 اللهم لا تحرمنا من فضلك الواسع',
        '🌞 صباح جميل عليكم\n🤲 اللهم اجعل هذا اليوم فاتحة خير علينا',
        '✨ يوم جديد\n🤲 اللهم وفقنا لما تحب وترضى',
        '☀️ صباحكم رضا وسعادة\n🤲 اللهم اجعل لنا نصيبًا من كل خير',
        '🌅 صباح الخير\n🤲 اللهم ارزقنا التوفيق والسداد وراحة البال',
        '🌞 صباح النور\n🤲 اللهم اجعل يومنا خفيفًا علينا مليئًا بالبركة',
        '✨ صباح الأمل\n🤲 اللهم بدّل همّنا فرجًا وارزقنا من واسع فضلك',
        '☕ صباح الهدوء\n🤲 اللهم اجعل رزقنا واسعًا وقلوبنا مطمئنة',
        '🌸 صباح الخير\n🤲 اللهم احفظنا بحفظك واصرف عنا السوء',
        '☀️ صباح جميل\n🤲 اللهم اجعلها بداية خير وأرزاق وستر',
        '🌅 صباح الورد\n🤲 اللهم ارزقنا خير هذا اليوم وخير ما بعده',
        '🌞 صباح السعادة\n🤲 اللهم اجعل لنا دعوة لا تُرد ورزقًا لا يُعد',
        '✨ صباح الخير\n🤲 اللهم بارك لنا في صحتنا وأهلنا وأرزاقنا'
      ]
    }
  };

  const T = TXT[lang] || TXT.en;

  if (!chatId.endsWith('@g.us')) {
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  let members = [];
  try {
    const metadata = await sock.groupMetadata(chatId);
    members = (metadata.participants || []).map(p => p.id).filter(Boolean);
  } catch {}

  const list = Array.isArray(T.messages) && T.messages.length ? T.messages : [];
  const text = list[Math.floor(Math.random() * list.length)] || (lang === 'ar' ? '☀️ صباح الخير!' : '☀️ Good morning!');

  await sock.sendMessage(
    chatId,
    {
      text,
      mentions: members
    },
    { quoted: message }
  );

  try {
    await sock.sendMessage(chatId, { react: { text: T.react || '☀️', key: message.key } });
  } catch {}
}

module.exports = {
  name: 'goodmorning',
  aliases: ['gm', 'صباح', 'صباح_الخير', 'good'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'يرسل رسالة صباح الخير عشوائية مع منشن مخفي لكل أعضاء الجروب.',
    en: 'Send a random good morning message with hidden mentions for all group members.'
  },
  usage: {
    ar: '.goodmorning / .gm',
    en: '.goodmorning / .gm'
  },
  emoji: '🌤',
  admin: false,
  owner: false,
  showInMenu: true,
  run: goodMorningCommand,

  // توافق مع القديم لو حد كان بينادي exec
  exec: goodMorningCommand
};
