const axios = require('axios');
const { getLang } = require('../../lib/lang');

async function cryptoCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '💰',
      title: '🧠 *Top Cryptocurrencies*\n\n',
      footer: 'Type the coin symbol to view price and details.',
      error: '❌ Unable to fetch market data right now. Please try again later.'
    },
    ar: {
      react: '💰',
      title: '🧠 *أشهر العملات الرقمية*\n\n',
      footer: 'اكتب اختصار العملة علشان تشوف السعر والتفاصيل.',
      error: '❌ مش قادر أجيب بيانات السوق دلوقتي. حاول بعد شوية.'
    }
  };

  const T = TXT[lang] || TXT.en;

  await sock.sendMessage(chatId, {
    react: { text: T.react, key: message.key }
  }).catch(() => {});

  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 10,
          page: 1
        },
        timeout: 15000
      }
    );

    let text = T.title;

    res.data.forEach((coin, i) => {
      text +=
        `${i + 1}. *${coin.name}*\n` +
        `📌 .${coin.symbol.toLowerCase()}\n\n`;
    });

    text += T.footer;

    await sock.sendMessage(
      chatId,
      { text },
      { quoted: message }
    );

  } catch (error) {
    console.error('[CRYPTO]', error?.message || error);
    await sock.sendMessage(
      chatId,
      { text: T.error },
      { quoted: message }
    );
  }
}

module.exports = {
  name: 'crypto',
  aliases: ['cr', 'coins'],

  category: {
    ar: '💰 أوامر الكريبتو',
    en: '💰 Crypto Commands'
  },

  description: {
    ar: 'عرض أشهر العملات الرقمية مع اختصاراتها.',
    en: 'Show top cryptocurrencies with their symbols.'
  },

  usage: {
    ar: '.crypto',
    en: '.crypto'
  },
emoji: '📈',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: cryptoCommand,
  run: cryptoCommand,
  execute: cryptoCommand
};