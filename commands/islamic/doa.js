const duas = require('../../data/duas');
const { getLang } = require('../../lib/lang');

async function duaCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '🤲', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      title: '📿 *Dua*',
      noData: '❌ No duas available.',
      fail: '❌ Failed to send the dua.'
    },
    ar: {
      title: '📿 *دعاء*',
      noData: '❌ لا يوجد أدعية متاحة.',
      fail: '❌ حصل خطأ أثناء إرسال الدعاء.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const list =
      lang === 'ar'
        ? (Array.isArray(duas?.ar) ? duas.ar : [])
        : (Array.isArray(duas?.en) ? duas.en : []);

    if (!list.length) {
      return await sock.sendMessage(chatId, { text: T.noData }, { quoted: message });
    }

    const randomDua = list[Math.floor(Math.random() * list.length)];
    return await sock.sendMessage(chatId, { text: `${T.title}\n\n${randomDua}` }, { quoted: message });

  } catch (error) {
    console.error('DUA ERROR:', error?.message || error);
    return await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'dua',
  aliases: ['دعاء', 'doa'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'إرسال دعاء عشوائي',
    en: 'Send a random dua'
  },
  emoji: '🤲',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: duaCommand
};