const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { UploadFileUgu, TelegraPh } = require('../../lib/uploader');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function getMediaBufferAndExt(message) {
  const m = message?.message || {};

  if (m.imageMessage) {
    const stream = await downloadContentFromMessage(m.imageMessage, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { buffer: Buffer.concat(chunks), ext: '.jpg' };
  }

  if (m.videoMessage) {
    const stream = await downloadContentFromMessage(m.videoMessage, 'video');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { buffer: Buffer.concat(chunks), ext: '.mp4' };
  }

  if (m.audioMessage) {
    const stream = await downloadContentFromMessage(m.audioMessage, 'audio');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { buffer: Buffer.concat(chunks), ext: '.mp3' };
  }

  if (m.documentMessage) {
    const stream = await downloadContentFromMessage(m.documentMessage, 'document');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    const fileName = m.documentMessage.fileName || 'file.bin';
    const ext = path.extname(fileName) || '.bin';
    return { buffer: Buffer.concat(chunks), ext };
  }

  if (m.stickerMessage) {
    const stream = await downloadContentFromMessage(m.stickerMessage, 'sticker');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { buffer: Buffer.concat(chunks), ext: '.webp' };
  }

  return null;
}

async function getQuotedMediaBufferAndExt(message) {
  const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
  if (!quoted) return null;
  return getMediaBufferAndExt({ message: quoted });
}

async function urlCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      needMedia: 'Send or reply to a media (image, video, audio, sticker, document) to get a URL.',
      uploadFail: '❌ Failed to upload media.',
      ok: (u) => `🔗 URL:\n${u}`,
      fail: '❌ Failed to convert media to URL.'
    },
    ar: {
      needMedia: 'ابعت أو رد على (صورة/فيديو/صوت/ملف/استيكر) عشان أطلعلك رابط.',
      uploadFail: '❌ فشل رفع الملف.',
      ok: (u) => `🔗 الرابط:\n${u}`,
      fail: '❌ حصل خطأ أثناء تحويل الميديا إلى رابط.'
    }
  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '🔗');

  try {
    try {
      await sock.presenceSubscribe(chatId);
      await sock.sendPresenceUpdate('composing', chatId);
    } catch {}

    let media = await getMediaBufferAndExt(message);
    if (!media) media = await getQuotedMediaBufferAndExt(message);

    if (!media) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.needMedia }, { quoted: message });
      return;
    }

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempPath = path.join(tempDir, `${Date.now()}${media.ext}`);
    fs.writeFileSync(tempPath, media.buffer);

    let url = '';

    try {
      const ext = String(media.ext || '').toLowerCase();
      const isImageLike = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

      if (isImageLike) {
        try {
          url = await TelegraPh(tempPath);
        } catch {
          const res = await UploadFileUgu(tempPath);
          url = typeof res === 'string' ? res : (res?.url || res?.url_full || '');
        }
      } else {
        const res = await UploadFileUgu(tempPath);
        url = typeof res === 'string' ? res : (res?.url || res?.url_full || '');
      }
    } finally {
      setTimeout(() => {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
      }, 2000);
    }

    if (!url) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.uploadFail }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: T.ok(url) }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[URL]', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */
module.exports = {
  name: 'url',
  aliases: ['url', 'tourl', 'upload', 'رابط', 'تحويل_لرابط', 'ارفع'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  emoji: '🔗',
  description: {
    ar: 'تحويل أي ميديا (صورة/فيديو/صوت/ملف/استيكر) إلى رابط مباشر.',
    en: 'Convert any media (image/video/audio/document/sticker) into a direct URL.'
  },
  usage: {
    ar: '.url (على ميديا أو رد على ميديا)',
    en: '.url (on media or reply to media)'
  },
  admin: false,
  owner: false,
  showInMenu: true,
  exec: urlCommand,
  run: urlCommand,
  execute: urlCommand
};