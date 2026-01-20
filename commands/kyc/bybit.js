const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function bybitCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '🎬',
      notFound: '❌ KYC video not found.',
      caption:
        '🎬 *Bybit KYC (API Link)*\n' +
        'Guide to verify Bybit using API link.\n\n' +
        '> Powered by EasyStep'
    },
    ar: {
      react: '🎬',
      notFound: '❌ فيديو التوثيق غير موجود.',
      caption:
        '🎬 *توثيق Bybit عن طريق الرابط (API Link)*\n' +
        'شرح توثيق بايبت باستخدام رابط الـ API.\n\n' +
        '> بواسطة EasyStep'
    }
  };

  const T = TXT[lang] || TXT.en;

  await sock.sendMessage(chatId, {
    react: { text: T.react, key: message.key }
  }).catch(() => {});

  const videoPath = path.join(
    process.cwd(),
    'assets',
    'kyc',
    'WA0021.mp4'
  );

  if (!fs.existsSync(videoPath)) {
    await sock.sendMessage(
      chatId,
      { text: T.notFound },
      { quoted: message }
    );
    return;
  }

  await sock.sendMessage(
    chatId,
    {
      video: fs.readFileSync(videoPath),
      mimetype: 'video/mp4',
      caption: T.caption
    },
    { quoted: message }
  );
}

module.exports = {
  name: 'bybit',
  aliases: ['by', 'بايبت', 'bybit_kyc'],

  category: {
    ar: '🛂 أوامر KYC',
    en: '🛂 KYC Commands'
  },

  description: {
    ar: 'شرح فيديو لطريقة توثيق حساب Bybit باستخدام رابط API.',
    en: 'Video guide to verify a Bybit account using API link.'
  },

  usage: {
    ar: '.bybit',
    en: '.bybit'
  },
emoji: '💹',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: bybitCommand,
  run: bybitCommand,
  execute: bybitCommand
};