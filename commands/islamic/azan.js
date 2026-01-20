const { getLang } = require('../../lib/lang');

function getAzanAudio() {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const wibHours = (utcHours + 7) % 24;

  if (wibHours >= 3 && wibHours <= 5) {
    return 'https://api.autoresbot.com/mp3/azan-subuh.m4a';
  }

  return 'https://api.autoresbot.com/mp3/azan-umum.m4a';
}

async function azanCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '🕌', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      duaTitle: '*Dua after Azan*',
      duaBody:
        'O Allah, make our hearts attached to الصلاة,\n' +
        'and grant us obedience, remembrance, and gratitude.',
      fail: '⚠️ Failed to play azan. Please try again.'
    },
    ar: {
      duaTitle: '*دعاء بعد الأذان*',
      duaBody:
        'اللهم اجعل قلوبنا معلّقة بالصلاة،\n' +
        'وارزقنا طاعتك وذكرك وشكرك على الدوام 🤲',
      fail: '⚠️ حصلت مشكلة أثناء تشغيل الأذان. جرّب تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const audioUrl = getAzanAudio();

    await sock.sendMessage(
      chatId,
      {
        audio: { url: audioUrl },
        mimetype: 'audio/mp4',
        ptt: false
      },
      { quoted: message }
    );

    setTimeout(async () => {
      try {
        const duaText =
          `📿 ${T.duaTitle}\n` +
          `━━━━━━━━━━━━━━\n` +
          `${T.duaBody}\n` +
          `━━━━━━━━━━━━━━\n` +
          `🕊️`;

        await sock.sendMessage(chatId, { text: duaText });
      } catch {}
    }, 60 * 1000);

  } catch (err) {
    console.error('AZAN ERROR:', err);
    await sock.sendMessage(chatId, {
      react: { text: '⚠️', key: message.key }
    }).catch(() => {});
    return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'azan',
  aliases: ['azan', 'اذان', 'الأذان'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'تشغيل الأذان ثم إرسال دعاء بعد دقيقة',
    en: 'Play azan audio then send a dua after 1 minute'
  },
  emoji: '🕌',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: azanCommand
};