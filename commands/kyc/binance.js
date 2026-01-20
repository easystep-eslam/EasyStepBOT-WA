const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function binanceCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '🎬',
      notFound: '❌ Video file not found.',
      caption:
        '🎬 *Binance Account Creation*\n' +
        'Step-by-step guide to create a Binance account.\n\n' +
        '> Powered by EasyStep'
    },
    ar: {
      react: '🎬',
      notFound: '❌ ملف الفيديو غير موجود.',
      caption:
        '🎬 *إنشاء حساب Binance*\n' +
        'شرح كامل لطريقة فتح حساب على منصة بينانس.\n\n' +
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
    'WA0005.mp4'
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
  name: 'binance',
  aliases: ['bi', 'بينانس'],

  category: {
    ar: '🛂 أوامر KYC',
    en: '🛂 KYC Commands'
  },

  description: {
    ar: 'شرح فيديو كامل لطريقة إنشاء حساب Binance.',
    en: 'Step-by-step video guide to create a Binance account.'
  },

  usage: {
    ar: '.binance',
    en: '.binance'
  },
emoji: '💹',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: binanceCommand,
  run: binanceCommand,
  execute: binanceCommand
};