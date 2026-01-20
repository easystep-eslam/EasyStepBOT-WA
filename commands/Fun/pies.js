const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

const BASE = 'https://api.shizo.top/pies';
const VALID_COUNTRIES = [
  'india',
  'malaysia',
  'thailand',
  'china',
  'indonesia',
  'japan',
  'korea',
  'vietnam'
];

async function fetchPiesImageBuffer(country) {
  const url = `${BASE}/${country}?apikey=shizo`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('image')) throw new Error('API did not return an image');

  return res.buffer();
}

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch {}
}

function getRawText(message) {
  return (
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    ''
  );
}

async function piesCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage: `🗣 Usage: .pies <country>\nAvailable:\n${VALID_COUNTRIES.join(', ')}`,
      invalid: (c) => `❌ Unsupported country: ${c}\nTry one of:\n${VALID_COUNTRIES.join(', ')}`,
      caption: (c) => `🥧 Pies from ${c}`,
      failed: '❌ Failed to fetch image. Please try again.'
    },
    ar: {
      usage: `🗣 الاستخدام: .pies <الدولة>\nالدول المتاحة:\n${VALID_COUNTRIES.join(', ')}`,
      invalid: (c) => `❌ الدولة غير مدعومة: ${c}\nجرب واحدة من:\n${VALID_COUNTRIES.join(', ')}`,
      caption: (c) => `🥧 فطائر من ${c}`,
      failed: '❌ فشل تحميل الصورة، جرّب تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  const raw = getRawText(message);
  const cmd = (raw.split(/\s+/)[0] || '').toLowerCase().replace(/^\./, '');

  let country = String(args?.[0] || '').toLowerCase().trim();

  if (!country) {
    const m = cmd.match(/^(india|malaysia|thailand|china|indonesia|japan|korea|vietnam)pies$/);
    if (m?.[1]) country = m[1];
  }

  if (!country) {
    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    return;
  }

  if (!VALID_COUNTRIES.includes(country)) {
    await sock.sendMessage(chatId, { text: T.invalid(country) }, { quoted: message });
    return;
  }

  try {
    await react(sock, message, '🥧');

    const imageBuffer = await fetchPiesImageBuffer(country);

    await sock.sendMessage(
      chatId,
      { image: imageBuffer, caption: T.caption(country) },
      { quoted: message }
    );

    await react(sock, message, '✅');
  } catch (err) {
    console.error('Error in pies command:', err?.message || err);
    await react(sock, message, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'pies',
  aliases: [
    'pies',
    'فطاير',
    'فطائر',
    'indiapies',
    'malaysiapies',
    'thailandpies',
    'chinapies',
    'indonesiapies',
    'japanpies',
    'koreapies',
    'vietnampies'
  ],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  description: {
    en: 'Get pies images by country.',
    ar: 'جيب صور فطائر حسب الدولة.'
  },
  usage: {
    en: '.pies <country>',
    ar: '.pies <الدولة>'
  },
  emoji: '🟠',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: piesCommand,
  run: piesCommand,
  execute: piesCommand
};