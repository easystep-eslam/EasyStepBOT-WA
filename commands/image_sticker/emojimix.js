const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, message, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
  } catch {}
}

async function emojimixCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage:
        'Usage:\n.emojimix 😎+🥰\n\nExample:\n.emojimix 😎+🥰',
      example: '🎴 Example: .emojimix 😎+🥰',
      needPlus:
        '✳️ Separate the emojis using a *+* sign\n\n📌 Example:\n.emojimix 😎+🥰',
      cannotMix: '❌ These emojis cannot be mixed! Try different ones.',
      failed:
        '❌ Failed to mix emojis! Make sure you are using valid emojis.\n\nExample: .emojimix 😎+🥰'
    },
    ar: {
      usage:
        'طريقة الاستخدام:\n.emojimix 😎+🥰\n\nمثال:\n.emojimix 😎+🥰',
      example: '🎴 مثال: .emojimix 😎+🥰',
      needPlus:
        '✳️ افصل الإيموجي بعلامة *+*\n\n📌 مثال:\n.emojimix 😎+🥰',
      cannotMix: '❌ الإيموجي دول مينفعش يتركبوا مع بعض! جرّب غيرهم.',
      failed:
        '❌ فشل تركيب الإيموجي! اتأكد إنك مستخدم إيموجي صح.\n\nمثال: .emojimix 😎+🥰'
    }
  };

  const T = TXT[lang] || TXT.en;

  const rawText =
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    '';

  const input =
    (Array.isArray(args) && args.length ? args.join(' ') : rawText.split(/\s+/).slice(1).join(' '))
      .trim();

  if (!input) {
    await safeReact(sock, chatId, message, '❓');
    await sock.sendMessage(chatId, { text: T.example + '\n\n' + T.usage }, { quoted: message });
    return;
  }

  if (!input.includes('+')) {
    await safeReact(sock, chatId, message, '✳️');
    await sock.sendMessage(chatId, { text: T.needPlus }, { quoted: message });
    return;
  }

  const [emoji1Raw, emoji2Raw] = input.split('+');
  const emoji1 = String(emoji1Raw || '').trim();
  const emoji2 = String(emoji2Raw || '').trim();

  if (!emoji1 || !emoji2) {
    await safeReact(sock, chatId, message, '❓');
    await sock.sendMessage(chatId, { text: T.needPlus }, { quoted: message });
    return;
  }

  try {
    await safeReact(sock, chatId, message, '🎨');

    const url =
      `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=` +
      `${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data?.results?.length) {
      await safeReact(sock, chatId, message, '😅');
      await sock.sendMessage(chatId, { text: T.cannotMix }, { quoted: message });
      return;
    }

    const imageUrl = data.results[0]?.url;
    if (!imageUrl) {
      await safeReact(sock, chatId, message, '⚠️');
      await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
      return;
    }

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tempFile = path.join(tmpDir, `emoji_${Date.now()}.png`).replace(/\\/g, '/');
    const outputFile = path.join(tmpDir, `sticker_${Date.now()}.webp`).replace(/\\/g, '/');

    const imageResponse = await fetch(imageUrl);
    const buffer = await imageResponse.buffer();
    fs.writeFileSync(tempFile, buffer);

    const ffmpegCommand =
      `ffmpeg -i "${tempFile}" ` +
      `-vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,` +
      `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" "${outputFile}"`;

    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, (err) => (err ? reject(err) : resolve()));
    });

    if (!fs.existsSync(outputFile)) throw new Error('Sticker not created');

    const stickerBuffer = fs.readFileSync(outputFile);

    await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });
    await safeReact(sock, chatId, message, '✅');

    try { fs.unlinkSync(tempFile); } catch {}
    try { fs.unlinkSync(outputFile); } catch {}

  } catch (error) {
    console.error('Error in emojimix command:', error);
    await safeReact(sock, chatId, message, '⚠️');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'emojimix',
  aliases: ['ايموجي_ميكس', 'تركيب_ايموجي'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'تركيب إيموجيين (Emoji Kitchen) وإرسالهم كستيكر.',
    en: 'Mix two emojis (Emoji Kitchen) and send as a sticker.'
  },
  usage: {
    ar: '.emojimix 😎+🥰',
    en: '.emojimix 😎+🥰'
  },
  emoji: '🧩',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: emojimixCommand
};