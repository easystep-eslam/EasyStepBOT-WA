const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

function asJidString(jid) {
  return typeof jid === 'string' ? jid : (jid?.id || jid?.toString?.() || '');
}

function pickTarget(quotedMsg, mentionedJid, sender) {
  const q = quotedMsg?.sender ? asJidString(quotedMsg.sender) : '';
  const m = Array.isArray(mentionedJid) && mentionedJid[0] ? asJidString(mentionedJid[0]) : '';
  const s = asJidString(sender);
  return q || m || s;
}

function getText(args, lang) {
  const input = Array.isArray(args) ? args.join(' ').trim() : '';
  if (input) return input;
  return lang === 'ar' ? 'ده كان قرار غريب 😅' : 'That was a weird choice 😅';
}

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch {}
}

async function stupidCommand(sock, message, args = [], ctx = {}) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      fail: "❌ I couldn't generate the card right now. Please try again later."
    },
    ar: {
      fail: '❌ مقدرتش أعمل الكارت دلوقتي.. جرّب تاني بعد شوية.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await react(sock, message, '🤡');

    const quotedMsg = ctx.quotedMsg;
    const mentionedJid = ctx.mentionedJid;
    const sender = ctx.sender || message.key.participant || message.key.remoteJid;

    const who = pickTarget(quotedMsg, mentionedJid, sender);
    const text = getText(args, lang);

    let avatarUrl;
    try {
      avatarUrl = await sock.profilePictureUrl(who, 'image');
    } catch {
      avatarUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
    }

    const apiUrl =
      `https://some-random-api.com/canvas/misc/its-so-stupid` +
      `?avatar=${encodeURIComponent(avatarUrl)}` +
      `&dog=${encodeURIComponent(text)}`;

    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API ${response.status}`);

    const imageBuffer = await response.buffer();

    const mentionTag = `@${who.split('@')[0]}`;
    const caption = lang === 'ar' ? `${mentionTag} 🤡` : `${mentionTag} 😂`;

    await sock.sendMessage(
      chatId,
      { image: imageBuffer, caption, mentions: [who] },
      { quoted: message }
    );

    await react(sock, message, '✅');
  } catch (error) {
    console.error('Error in stupid command:', error?.message || error);
    await react(sock, message, '❌');
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'stupid',
  aliases: ['stupid', 'itsstupid', 'stupidcard', 'غبي', 'غباء', 'كارت_غباء'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  description: {
    ar: 'ينشئ كارت "Its so stupid" لشخص (منشن/ريبلاي/أو أنت) مع نص اختياري.',
    en: 'Generate an "Its so stupid" card for a user (mention/reply/or you) with optional text.'
  },
  usage: {
    ar: '.stupid @user <نص اختياري> (أو رد على رسالة)',
    en: '.stupid @user <optional text> (or reply)'
  },
  emoji: '😵‍💫',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: stupidCommand,
  run: stupidCommand,
  execute: stupidCommand
};