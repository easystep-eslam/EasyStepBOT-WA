const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

async function memeCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    caption: {
      ar: '> اتفضل الميم بتاعك 😄🗣',
      en: "> Here's your cheems meme! 🐕🗣"
    },
    btnMeme: {
      ar: '🎭 ميم تاني',
      en: '🎭 Another Meme'
    },
    btnJoke: {
      ar: '😄 نكتة',
      en: '😄 Joke'
    },
    fail: {
      ar: '❌ فشل يجيب ميم.. جرّب تاني بعد شوية.',
      en: '❌ Failed to fetch meme. Please try again later.'
    }
  };

  const T = {
    caption: TXT.caption[lang] || TXT.caption.en,
    btnMeme: TXT.btnMeme[lang] || TXT.btnMeme.en,
    btnJoke: TXT.btnJoke[lang] || TXT.btnJoke.en,
    fail: TXT.fail[lang] || TXT.fail.en
  };

  try {
    await sock.sendMessage(chatId, {
      react: { text: '🎭', key: message.key }
    }).catch(() => {});

    const response = await fetch(
      'https://shizoapi.onrender.com/api/memes/cheems?apikey=shizo'
    );

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image')) throw new Error('Invalid content');

    const imageBuffer = await response.buffer();

    const buttons = [
      { buttonId: 'meme', buttonText: { displayText: T.btnMeme }, type: 1 },
      { buttonId: 'joke', buttonText: { displayText: T.btnJoke }, type: 1 }
    ];

    await sock.sendMessage(
      chatId,
      {
        image: imageBuffer,
        caption: T.caption,
        buttons,
        headerType: 1
      },
      { quoted: message }
    );

    await sock.sendMessage(chatId, {
      react: { text: '✅', key: message.key }
    }).catch(() => {});

  } catch (error) {
    console.error('MEME COMMAND ERROR:', error);

    await sock.sendMessage(chatId, {
      react: { text: '❌', key: message.key }
    }).catch(() => {});

    await sock.sendMessage(
      chatId,
      { text: T.fail },
      { quoted: message }
    );
  }
}

module.exports = {
  name: 'meme',
  aliases: ['meme', 'ميم'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  emoji: '🎭',
  admin: false,
  owner: false,
  showInMenu: true,
  run: memeCommand,
  exec: memeCommand,
  execute: memeCommand
};