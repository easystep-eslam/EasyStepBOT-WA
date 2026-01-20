const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function bitgetCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '🎬',
      notFound: '❌ KYC video not found.',
      caption:
        '🎬 *Bitget KYC*\n' +
        'Step-by-step guide to create and verify a Bitget account.\n\n' +
        '> Powered by EasyStep'
    },
    ar: {
      react: '🎬',
      notFound: '❌ فيديو التحقق غير موجود.',
      caption:
        '🎬 *توثيق حساب Bitget*\n' +
        'شرح كامل لإنشاء وتوثيق حساب على منصة Bitget.\n\n' +
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
    'WA0006.mp4'
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
  name: 'bitget',
  aliases: ['bit', 'بيت_جت', 'bitget_kyc'],

  category: {
    ar: '🛂 أوامر KYC',
    en: '🛂 KYC Commands'
  },

  description: {
    ar: 'شرح فيديو كامل لطريقة إنشاء وتوثيق حساب Bitget.',
    en: 'Step-by-step video guide to create and verify a Bitget account.'
  },

  usage: {
    ar: '.bitget',
    en: '.bitget'
  },
emoji: '💹',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: bitgetCommand,
  run: bitgetCommand,
  execute: bitgetCommand
};