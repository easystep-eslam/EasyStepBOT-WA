const { getLang } = require('../../lib/lang');

async function goodNightCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      react: '🌙',
      messages: [
        '🌙 Good night everyone.\n🤲 May Allah grant you all peace and restful sleep.',
        '🌙 Wishing you all a calm night and hearts full of tranquility.',
        '😴 Good night to everyone.\n🤲 May your rest be peaceful and your worries fade away.',
        '🌙 May this night bring comfort and serenity to you all.',
        '🌙 Good night everyone.\n🤲 May tomorrow be better and filled with goodness.',
        '😌 Time to rest.\n🌙 May Allah protect you all throughout the night.',
        '🌙 Wishing everyone a quiet night and renewed strength.',
        '🌙 Good night to you all.\n🤲 May Allah ease your hearts.',
        '😴 May you all sleep peacefully and wake up refreshed.',
        '🌙 Good night everyone.\n🤲 May Allah grant you comfort and reassurance.',
        '🌙 Night has come.\n🤲 May peace surround you all.',
        '😌 Rest well everyone.\n🌙 May your sleep be calm and healing.',
        '🌙 Good night to everyone.\n🤲 May Allah watch over you.',
        '🌙 A peaceful night to you all.\n🤍 Sleep with ease.',
        '😴 May Allah bless your rest tonight.',
        '🌙 Good night everyone.\n🤲 May your hearts find peace.',
        '🌙 May this night bring you clarity and calm.',
        '😌 Sleep peacefully everyone.\n🌙 Tomorrow is a new beginning.',
        '🌙 Good night to you all.\n🤲 May Allah grant you safety.',
        '🌙 Wishing you all a night of serenity and rest.'
      ]
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      react: '🌙',
      messages: [
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم ارزقنا وإياكم راحة البال وهدوء النفس',
        '😴 تصبحوا على خير جميعًا\n🤲 اللهم اجعل نومنا طمأنينة لقلوبنا',
        '🌙 ليلة هادئة عليكم جميعًا\n🤲 اللهم احفظنا بعينك التي لا تنام',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعلها ليلة سلام وأمان',
        '😌 ناموا على خير جميعًا\n🤲 اللهم أرح قلوبنا واغفر لنا',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعل نومنا عبادة وراحة',
        '🌙 ليلة طيبة عليكم جميعًا\n🤲 اللهم احفظنا وأهلنا',
        '😴 تصبحوا على خير جميعًا\n🤲 اللهم اجعل الغد أفضل لنا جميعًا',
        '🌙 ناموا على خير جميعًا\n🤲 اللهم ارزقنا السكينة',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم ارزقنا نومًا هادئًا',
        '🌙 ليلة هادئة عليكم جميعًا\n🤲 اللهم اجعل قلوبنا مطمئنة',
        '😴 ناموا على خير جميعًا\n🤲 اللهم أبعد عنا القلق والتعب',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعلها ليلة راحة وسلام',
        '🌙 ليلة مباركة عليكم جميعًا\n🤲 اللهم اكتب لنا الطمأنينة',
        '😌 ناموا على خير جميعًا\n🤲 اللهم احفظنا من كل سوء',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعل نومنا شفاءً لأجسادنا',
        '🌙 ليلة هادئة عليكم جميعًا\n🤲 اللهم اشرح صدورنا',
        '😴 ناموا على خير جميعًا\n🤲 اللهم اجعل أحلامنا خيرًا',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم ارزقنا السكون',
        '🌙 ليلة طيبة عليكم جميعًا\n🤲 اللهم اجعل صباحنا خيرًا',
        '😌 ناموا على خير جميعًا\n🤲 اللهم اجعلنا في حفظك',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعلها ليلة رحمة',
        '🌙 ليلة سلام عليكم جميعًا\n🤲 اللهم طهّر قلوبنا',
        '😴 ناموا على خير جميعًا\n🤲 اللهم ارزقنا راحة البال',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعل نومنا هادئًا',
        '🌙 ليلة هادئة عليكم جميعًا\n🤲 اللهم احفظنا من كل شر',
        '😌 ناموا على خير جميعًا\n🤲 اللهم اجعلنا من الآمنين',
        '🌙 تصبحوا على خير جميعًا\n🤲 اللهم اجعلها ليلة طيبة',
        '🌙 ليلة مباركة عليكم جميعًا\n🤲 اللهم اغفر لنا',
        '😴 ناموا على خير جميعًا\n🤲 اللهم اجعل الغد خيرًا لنا'
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

  const list = T.messages;
  const text = list[Math.floor(Math.random() * list.length)];

  await sock.sendMessage(
    chatId,
    {
      text,
      mentions: members
    },
    { quoted: message }
  );

  try {
    await sock.sendMessage(chatId, {
      react: { text: T.react, key: message.key }
    });
  } catch {}
}

module.exports = {
  name: 'goodnight',
  aliases: ['gn', 'تصبحوا', 'ناموا', 'تصبحو'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'يرسل رسالة تصبحوا على خير هادئة بصيغة الجمع مع منشن مخفي.',
    en: 'Send a calm good night message in plural form with hidden mentions.'
  },
  usage: {
    ar: '.goodnight / .gn',
    en: '.goodnight / .gn'
  },
  emoji: '🥱',

  admin: false,
  owner: false,
  showInMenu: true,
  run: goodNightCommand,
  exec: goodNightCommand
};