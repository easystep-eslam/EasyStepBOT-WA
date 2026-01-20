const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch {}
}

async function simpCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      needTarget: 'Please mention someone or reply to their message.',
      caption: '🗣 Certified SIMP 💳',
      failed: '❌ Failed to generate simp card. Try again later.'
    },
    ar: {
      needTarget: 'من فضلك اعمل منشن لشخص أو رد على رسالته.',
      caption: '🗣 سمب معتمد رسميًا 💳',
      failed: '❌ حصل خطأ وأنا بعمل الكرت.. جرّب تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await react(sock, message, '💳');

    const ctx = message.message?.extendedTextMessage?.contextInfo;

    const mentioned = ctx?.mentionedJid;
    const repliedParticipant = ctx?.participant;

    const target =
      (Array.isArray(mentioned) && mentioned[0]) ||
      repliedParticipant ||
      (message.key.participant || message.key.remoteJid);

    if (!target) {
      await react(sock, message, '❌');
      return await sock.sendMessage(chatId, { text: T.needTarget }, { quoted: message });
    }

    let avatar;
    try {
      avatar = await sock.profilePictureUrl(target, 'image');
    } catch {
      avatar = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
    }

    const apiUrl =
      `https://some-random-api.com/canvas/misc/simpcard?avatar=${encodeURIComponent(avatar)}`;

    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

    const buffer = await res.buffer();

    await sock.sendMessage(
      chatId,
      { image: buffer, caption: T.caption, mentions: [target] },
      { quoted: message }
    );

    await react(sock, message, '✅');
  } catch (err) {
    console.error('simp error:', err);
    await react(sock, message, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'simp',
  aliases: ['simp', 'سمب', 'سمبنه'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  description: {
    ar: 'ينشئ Simp Card لعضو (منشن/ريبلاي/أو أنت).',
    en: 'Generate a Simp Card for a user (mention/reply/or you).'
  },
  usage: {
    ar: '.simp @user (أو رد على رسالة)',
    en: '.simp @user (or reply)'
  },
  emoji: '🤡',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: simpCommand,
  run: simpCommand,
  execute: simpCommand
};