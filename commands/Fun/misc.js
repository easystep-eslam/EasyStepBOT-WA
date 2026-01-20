const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../../lib/uploadImage');
const { getLang } = require('../../lib/lang');

const ALIASES = {
  heart: ['heart', 'love', 'قلب'],
  horny: ['horny', 'h'],
  circle: ['circle', 'round'],
  lgbt: ['lgbt', 'rainbow'],
  lied: ['lied', 'liar'],
  lolice: ['lolice', 'police'],
  simpcard: ['simpcard', 'simp'],
  tonikawa: ['tonikawa', 'anime'],
  'its-so-stupid': ['its-so-stupid', 'stupid', 'غبي'],
  namecard: ['namecard', 'card', 'كارت'],
  oogway: ['oogway', 'wisdom'],
  oogway2: ['oogway2'],
  tweet: ['tweet', 'twitter'],
  'youtube-comment': ['youtube-comment', 'ytcomment'],
  comrade: ['comrade'],
  gay: ['gay'],
  glass: ['glass'],
  jail: ['jail', 'سجن'],
  passed: ['passed'],
  triggered: ['triggered']
};

function resolveAlias(input) {
  const v = String(input || '').toLowerCase().trim();
  for (const key in ALIASES) {
    if (ALIASES[key].includes(v)) return key;
  }
  return v;
}

function getTXT(chatId) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      help:
        `🎨 *MISC*\n\n` +
        `Usage:\n` +
        `.misc heart\n` +
        `.misc circle\n` +
        `.misc lgbt\n` +
        `.misc lied\n` +
        `.misc lolice\n` +
        `.misc simpcard\n` +
        `.misc tonikawa\n\n` +
        `Tip: Send an image, reply to an image, or mention someone.`,
      needImage: '❌ Please send an image, reply to an image, or mention someone.',
      fail: '❌ Failed to process. Please try again.'
    },
    ar: {
      help:
        `🎨 *MISC*\n\n` +
        `الاستخدام:\n` +
        `.misc heart\n` +
        `.misc circle\n` +
        `.misc lgbt\n` +
        `.misc lied\n` +
        `.misc lolice\n` +
        `.misc simpcard\n` +
        `.misc tonikawa\n\n` +
        `ملاحظة: ابعت صورة / اعمل ريبلاي على صورة / منشن شخص.`,
      needImage: '❌ لازم تبعت صورة أو تعمل ريبلاي على صورة أو منشن شخص.',
      fail: '❌ حصلت مشكلة أثناء التنفيذ. جرّب تاني.'
    }
  };

  return TXT[lang] || TXT.en;
}

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch {}
}

async function getQuotedOrOwnImageUrl(sock, message) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quoted?.imageMessage) {
    const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return await uploadImage(Buffer.concat(chunks));
  }

  if (message.message?.imageMessage) {
    const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return await uploadImage(Buffer.concat(chunks));
  }

  const ctx = message.message?.extendedTextMessage?.contextInfo;
  const targetJid =
    (ctx?.mentionedJid && ctx.mentionedJid.length ? ctx.mentionedJid[0] : null) ||
    ctx?.participant ||
    message.key.participant ||
    message.key.remoteJid;

  try {
    return await sock.profilePictureUrl(targetJid, 'image');
  } catch {
    return 'https://i.imgur.com/2wzGhpF.png';
  }
}

async function miscCommand(sock, chatId, message, args) {
  const TXT = getTXT(chatId);

  const list = Array.isArray(args) ? args : [];
  const fixedArgs = list[0]?.toLowerCase() === 'misc' ? list.slice(1) : list;

  if (!fixedArgs.length) {
    await sock.sendMessage(chatId, { text: TXT.help }, { quoted: message });
    return;
  }

  const sub = resolveAlias(fixedArgs[0]);

  const ENDPOINTS = {
    heart: { endpoint: 'heart', emoji: '❤️' },
    horny: { endpoint: 'horny', emoji: '😈' },
    circle: { endpoint: 'circle', emoji: '⭕' },
    lgbt: { endpoint: 'lgbt', emoji: '🌈' },
    lied: { endpoint: 'lied', emoji: '🤥' },
    lolice: { endpoint: 'lolice', emoji: '🚓' },
    simpcard: { endpoint: 'simpcard', emoji: '🥴' },
    tonikawa: { endpoint: 'tonikawa', emoji: '🎌' }
  };

  const chosen = ENDPOINTS[sub];
  if (!chosen) {
    await sock.sendMessage(chatId, { text: TXT.help }, { quoted: message });
    return;
  }

  try {
    await react(sock, message, chosen.emoji);

    const avatarUrl = await getQuotedOrOwnImageUrl(sock, message);
    if (!avatarUrl) {
      await sock.sendMessage(chatId, { text: TXT.needImage }, { quoted: message });
      return;
    }

    const url = `https://api.some-random-api.com/canvas/misc/${chosen.endpoint}?avatar=${encodeURIComponent(avatarUrl)}`;

    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res?.data) throw new Error('No data returned');

    await sock.sendMessage(
      chatId,
      { image: Buffer.from(res.data) },
      { quoted: message }
    );

    await react(sock, message, '✅');
  } catch (err) {
    console.error('MISC ERROR:', err?.message || err);
    await react(sock, message, '❌');
    await sock.sendMessage(chatId, { text: TXT.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'misc',
  aliases: ['misc', 'تأثير', 'تاثير', 'ميمز'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  description: {
    ar: 'تأثيرات/ميمز على صورة (صورة/ريبلاي/منشن/بروفايل).',
    en: 'Apply misc effects/memes to an image (image/reply/mention/profile).'
  },
  usage: {
    ar: '.misc heart | circle | lgbt | lied | lolice | simpcard | tonikawa',
    en: '.misc heart | circle | lgbt | lied | lolice | simpcard | tonikawa'
  },
  emoji: '🧩',
  admin: false,
  owner: false,
  showInMenu: true,
  run: async (sock, message, args) => miscCommand(sock, message.key.remoteJid, message, args || []),
  exec: async (sock, message, args) => miscCommand(sock, message.key.remoteJid, message, args || []),
  execute: async (sock, message, args) => miscCommand(sock, message.key.remoteJid, message, args || [])
};