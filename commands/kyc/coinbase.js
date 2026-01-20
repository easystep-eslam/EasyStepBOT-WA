const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function coinbaseCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '🎥',
      notFound: '❌ Coinbase KYC video not found.',
      caption:
        '🎥 *Coinbase KYC Guide*\n' +
        'Step-by-step explanation for using and verifying Coinbase.\n\n' +
        '> Powered by EasyStep'
    },
    ar: {
      react: '🎥',
      notFound: '❌ فيديو شرح Coinbase غير موجود.',
      caption:
        '🎥 *شرح Coinbase*\n' +
        'شرح استخدام وتوثيق منصة كوينبيس خطوة بخطوة.\n\n' +
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
    'WA0002.mp4'
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
  name: 'coinbase',
  aliases: ['cb', 'كوينبيس', 'coinbase_kyc'],

  category: {
    ar: '🛂 أوامر KYC',
    en: '🛂 KYC Commands'
  },

  description: {
    ar: 'شرح فيديو لطريقة استخدام وتوثيق حساب Coinbase.',
    en: 'Video guide explaining how to use and verify a Coinbase account.'
  },

  usage: {
    ar: '.coinbase',
    en: '.coinbase'
  },
emoji: '💹',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: coinbaseCommand,
  run: coinbaseCommand,
  execute: coinbaseCommand
};