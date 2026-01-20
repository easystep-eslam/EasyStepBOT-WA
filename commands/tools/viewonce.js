const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function bufferFromMedia(mediaMessage, type) {
  const stream = await downloadContentFromMessage(mediaMessage, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function viewOnceCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage: '❌ Please reply to a view-once image or video.',
      failed: '❌ Failed to open view-once media. Try again.'
    },
    ar: {
      usage: '❌ لازم ترد على صورة أو فيديو View Once.',
      failed: '❌ حصل خطأ ومقدرتش أفتح الـ View Once. جرّب تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '👁️');

  try {
    try {
      await sock.presenceSubscribe(chatId);
      await sock.sendPresenceUpdate('composing', chatId);
    } catch {}

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      await safeReact(sock, chatId, message.key, '❌');
      return await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    }

    const quotedImage = quoted.imageMessage || null;
    const quotedVideo = quoted.videoMessage || null;

    if (quotedImage?.viewOnce) {
      const buf = await bufferFromMedia(quotedImage, 'image');
      await safeReact(sock, chatId, message.key, '✅');
      return await sock.sendMessage(
        chatId,
        {
          image: buf,
          fileName: 'viewonce.jpg',
          caption: quotedImage.caption || ''
        },
        { quoted: message }
      );
    }

    if (quotedVideo?.viewOnce) {
      const buf = await bufferFromMedia(quotedVideo, 'video');
      await safeReact(sock, chatId, message.key, '✅');
      return await sock.sendMessage(
        chatId,
        {
          video: buf,
          mimetype: 'video/mp4',
          fileName: 'viewonce.mp4',
          caption: quotedVideo.caption || ''
        },
        { quoted: message }
      );
    }

    await safeReact(sock, chatId, message.key, '❌');
    return await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
  } catch (error) {
    console.error('[VIEWONCE]', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    return await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */
module.exports = {
  name: 'viewonce',
  aliases: ['vo', 'openonce', 'فيو_ونس', 'فتح_فيو_ونس', 'فتح_مرة'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  emoji: '👁️',
  description: {
    ar: 'فتح الصور والفيديوهات ذات العرض مرة واحدة.',
    en: 'Open view-once images and videos.'
  },
  usage: {
    ar: '.viewonce (رد على View Once)',
    en: '.viewonce (reply to a View Once)'
  },
  admin: false,
  owner: false,
  showInMenu: true,
  exec: viewOnceCommand,
  run: viewOnceCommand,
  execute: viewOnceCommand
};
