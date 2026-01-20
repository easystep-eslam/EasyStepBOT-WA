const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function getQuotedMessage(message) {
  return message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function getQuotedType(quotedMsg) {
  if (!quotedMsg || typeof quotedMsg !== 'object') return null;
  const keys = Object.keys(quotedMsg);
  return keys.length ? keys[0] : null;
}

function getText(lang, key) {
  const TXT = {
    en: {
      usage: '📌 Usage:\n• Reply to an image/video with .sticker\n• Or send an image/video with caption .sticker',
      reply: '❌ Reply to an image or video!',
      only: '❌ Reply to an image or video only!',
      success: '✅ Sticker created successfully!',
      fail: '❌ Failed to create sticker!'
    },
    ar: {
      usage: '📌 الاستخدام:\n• رد على صورة/فيديو واكتب .sticker\n• أو ابعت صورة/فيديو بكابشن .sticker',
      reply: '❌ رد على صورة أو فيديو!',
      only: '❌ لازم ترد على صورة أو فيديو بس!',
      success: '✅ تم إنشاء الستكر بنجاح!',
      fail: '❌ فشل عمل الستكر!'
    }
  };

  return (TXT[lang] && TXT[lang][key]) || (TXT.en && TXT.en[key]) || '';
}

async function ensureTempDir() {
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

async function downloadToBuffer(mediaMessage, mediaType) {
  const stream = await downloadContentFromMessage(mediaMessage, mediaType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function runFfmpeg(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error) => (error ? reject(error) : resolve()));
  });
}

function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

async function stickerCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  try {
    await safeReact(sock, chatId, message.key, '🧩');

    const quotedMsg = getQuotedMessage(message);
    const hasOwnImage = !!message.message?.imageMessage;
    const hasOwnVideo = !!message.message?.videoMessage;

    // لو مفيش رد ومفيش ميديا في نفس الرسالة
    if (!quotedMsg && !hasOwnImage && !hasOwnVideo) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: getText(lang, 'usage') }, { quoted: message });
      return;
    }

    let type = null;
    let mediaObj = null;
    let mediaType = null;

    // 1) من الريپلای
    if (quotedMsg) {
      type = getQuotedType(quotedMsg);
      if (!['imageMessage', 'videoMessage'].includes(type)) {
        await safeReact(sock, chatId, message.key, '❌');
        await sock.sendMessage(chatId, { text: getText(lang, 'only') }, { quoted: message });
        return;
      }
      const isImage = type === 'imageMessage';
      mediaType = isImage ? 'image' : 'video';
      mediaObj = quotedMsg[type];
    } else {
      // 2) من نفس الرسالة (صورة/فيديو بكابشن)
      if (hasOwnImage) {
        type = 'imageMessage';
        mediaType = 'image';
        mediaObj = message.message.imageMessage;
      } else if (hasOwnVideo) {
        type = 'videoMessage';
        mediaType = 'video';
        mediaObj = message.message.videoMessage;
      }
    }

    if (!mediaObj || !mediaType) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: getText(lang, 'reply') }, { quoted: message });
      return;
    }

    const buf = await downloadToBuffer(mediaObj, mediaType);
    if (!buf || !buf.length) throw new Error('Empty media buffer');

    const tempDir = await ensureTempDir();

    const stamp = Date.now();
    const tempInput = path.join(tempDir, `temp_${stamp}.${type === 'imageMessage' ? 'jpg' : 'mp4'}`);
    const tempOutput = path.join(tempDir, `sticker_${stamp}.webp`);

    fs.writeFileSync(tempInput, buf);

    const vf = `scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease`;
    const cmd =
      type === 'imageMessage'
        ? `ffmpeg -y -i "${tempInput}" -vf "${vf}" -vcodec libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p "${tempOutput}"`
        : `ffmpeg -y -i "${tempInput}" -vf "${vf},fps=12" -c:v libwebp -preset default -loop 0 -vsync 0 -t 6 -pix_fmt yuva420p "${tempOutput}"`;

    await runFfmpeg(cmd);

    const stickerBuf = fs.readFileSync(tempOutput);
    if (!stickerBuf || !stickerBuf.length) throw new Error('Sticker output empty');

    await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✅');

    safeUnlink(tempInput);
    safeUnlink(tempOutput);
  } catch (error) {
    console.error('[STICKER]', error?.stack || error);
    await safeReact(sock, message?.key?.remoteJid, message?.key, '❌');

    try {
      const chatId2 = message?.key?.remoteJid;
      if (chatId2) {
        const lang2 = getLang(chatId2);
        await sock.sendMessage(chatId2, { text: getText(lang2, 'fail') }, { quoted: message });
      }
    } catch {}
  }
}

module.exports = {
  name: 'sticker',
  aliases: ['sticker', 's', 'st', 'ستيكر', 'ملصق'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'تحويل صورة/فيديو (بالرد أو بإرسال ميديا مع كابشن) إلى ستيكر.',
    en: 'Convert an image/video (reply or send with caption) to a sticker.'
  },
  usage: {
    ar: '.sticker (رد على صورة/فيديو) أو ابعت صورة/فيديو بكابشن .sticker',
    en: '.sticker (reply to image/video) or send image/video with caption .sticker'
  },
  admin: false,
  owner: false,
  showInMenu: true,
  emoji: '🧩',
  exec: stickerCommand,
  run: stickerCommand,
  execute: stickerCommand
};
