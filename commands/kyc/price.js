const axios = require('axios');
const { getLang } = require('../../lib/lang');

const SYMBOL_MAP = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'tether',
  bnb: 'binancecoin',
  sol: 'solana',
  xrp: 'ripple',
  doge: 'dogecoin',
  trx: 'tron'
};

function getUsedCommandName(message) {
  const raw =
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    '';

  const first = raw.split(/\s+/)[0] || '';
  return (first.startsWith('.') ? first.slice(1) : first).toLowerCase();
}

function safeNum(n, digits = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '-';
  return x.toFixed(digits);
}

function safeMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '-';
  return x.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function priceCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '💰',
      notSupported: '❌ This coin is not supported.',
      fetchingError: '❌ Failed to fetch coin data. Try again later.',
      text: (coin, sym) => {
        const md = coin?.market_data || {};
        const about = stripHtml(coin?.description?.en).slice(0, 220);
        return (
          `┏━━━━━━┫ EasyStep-BOT ┣━━━━━━┓\n` +
          `┃ 🪙 *${coin?.name || sym.toUpperCase()}* (${String(sym).toUpperCase()})\n` +
          `┣━━━━━━━━━━━━━━━━━━━━━\n` +
          `┃ 💰 Price      : $${safeMoney(md?.current_price?.usd)}\n` +
          `┃ 📈 High 24h   : $${safeMoney(md?.high_24h?.usd)}\n` +
          `┃ 📉 Low 24h    : $${safeMoney(md?.low_24h?.usd)}\n` +
          `┃ 📊 Change 24h : ${safeNum(md?.price_change_percentage_24h, 2)}%\n` +
          `┣━━━━━━━━━━━━━━━━━━━━━\n` +
          `┃ 📰 About:\n` +
          `┃ ${about ? about + '...' : 'No description.'}\n` +
          `┗━━━━━━━━━━━━━━━━━━━━━\n` +
          `> © EasyStep`
        );
      }
    },
    ar: {
      react: '💰',
      notSupported: '❌ العملة دي مش مدعومة.',
      fetchingError: '❌ حصلت مشكلة في جلب البيانات. جرّب تاني بعد شوية.',
      text: (coin, sym) => {
        const md = coin?.market_data || {};
        const about = stripHtml(coin?.description?.en).slice(0, 220);
        return (
          `┏━━━━━━┫ EasyStep-BOT ┣━━━━━━┓\n` +
          `┃ 🪙 *${coin?.name || sym.toUpperCase()}* (${String(sym).toUpperCase()})\n` +
          `┣━━━━━━━━━━━━━━━━━━━━━\n` +
          `┃ 💰 السعر       : $${safeMoney(md?.current_price?.usd)}\n` +
          `┃ 📈 أعلى 24h    : $${safeMoney(md?.high_24h?.usd)}\n` +
          `┃ 📉 أقل 24h     : $${safeMoney(md?.low_24h?.usd)}\n` +
          `┃ 📊 التغير 24h  : ${safeNum(md?.price_change_percentage_24h, 2)}%\n` +
          `┣━━━━━━━━━━━━━━━━━━━━━\n` +
          `┃ 📰 نبذة:\n` +
          `┃ ${about ? about + '...' : 'لا توجد نبذة.'}\n` +
          `┗━━━━━━━━━━━━━━━━━━━━━\n` +
          `> © EasyStep`
        );
      }
    }
  };

  const T = TXT[lang] || TXT.en;

  await sock
    .sendMessage(chatId, { react: { text: T.react, key: message.key } })
    .catch(() => {});

  const cmd = getUsedCommandName(message);
  const coinId = SYMBOL_MAP[cmd];

  if (!coinId) {
    await sock.sendMessage(chatId, { text: T.notSupported }, { quoted: message });
    return;
  }

  try {
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`, {
      timeout: 15000
    });

    const coin = res.data || {};
    await sock.sendMessage(chatId, { text: T.text(coin, cmd) }, { quoted: message });
  } catch (err) {
    console.error('[PRICE]', err?.message || err);
    await sock.sendMessage(chatId, { text: T.fetchingError }, { quoted: message });
  }
}

module.exports = {
  name: 'price',
  aliases: Object.keys(SYMBOL_MAP),

  category: {
    ar: '💰 أوامر الكريبتو',
    en: '💰 Crypto Commands'
  },

  description: {
    ar: 'عرض سعر وتفاصيل عملة (مثل: .btc / .eth).',
    en: 'Show coin price & details (e.g. .btc / .eth).'
  },

  usage: {
    ar: '.btc / .eth / .usdt / .bnb / .sol / .xrp / .doge / .trx',
    en: '.btc / .eth / .usdt / .bnb / .sol / .xrp / .doge / .trx'
  },
emoji: '🪙',
  admin: false,
  owner: false,
  showInMenu: false,

  exec: priceCommand,
  run: priceCommand,
  execute: priceCommand
};