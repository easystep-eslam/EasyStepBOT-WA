const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

function getRawText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  ).trim();
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function ttsCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      needText: '❌ Please provide text to convert to voice.\nExample:\n.tts hello world',
      failed: '❌ Failed to generate voice. Please try again later.'
    },
    ar: {
      needText: '❌ اكتب النص اللي عايز تحوله لصوت.\nمثال:\n.tts ازيك يا صاحبي',
      failed: '❌ حصل خطأ أثناء إنشاء الصوت.. جرّب تاني بعد شوية.'
    }
  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '🗣️');

  try {
    try {
      await sock.presenceSubscribe(chatId);
      await sock.sendPresenceUpdate('composing', chatId);
    } catch {}

    let text = Array.isArray(args) && args.length ? args.join(' ').trim() : '';

    if (!text) {
      const raw = getRawText(message);
      const used = (raw.split(/\s+/)[0] || '.tts').trim();
      text = raw.slice(used.length).trim();
    }

    if (!text) {
      await safeReact(sock, chatId, message.key, '❌');
      return await sock.sendMessage(chatId, { text: T.needText }, { quoted: message });
    }

    const ttsLang = lang === 'ar' ? 'ar' : 'en';

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `tts_${Date.now()}.mp3`);
    const gtts = new gTTS(text, ttsLang);

    await new Promise((resolve, reject) => {
      gtts.save(filePath, (err) => (err ? reject(err) : resolve()));
    });

    const audioBuffer = fs.readFileSync(filePath);

    await sock.sendMessage(
      chatId,
      {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: false
      },
      { quoted: message }
    );

    try { fs.unlinkSync(filePath); } catch {}

    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[TTS]', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */
module.exports = {
  name: 'tts',
  aliases: ['tts', 'say', 'voice', 'قول', 'نطق', 'صوت'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  emoji: '🗣️',
  description: {
    ar: 'تحويل نص إلى رسالة صوتية حسب لغة الجروب.',
    en: 'Convert text to a voice message based on group language.'
  },
  usage: {
    ar: '.tts <نص>',
    en: '.tts <text>'
  },
  admin: false,
  owner: false,
  showInMenu: true,
  exec: ttsCommand,
  run: ttsCommand,
  execute: (sock, message, args) => ttsCommand(sock, message, args)
};