/**
 * sticker
 * Convert image/video to sticker (WEBP).
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../../settings');
const webp = require('node-webpmux');
const crypto = require('crypto');
const { getLang } = require('../../lib/lang');

async function stickerCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      noMedia: 'Reply to an image/video with *.sticker* or send an image/video with caption *.sticker*.',
      dlFail: 'Failed to download media. Please try again.',
      fail: 'Failed to create sticker! Try again later.'
    },
    ar: {
      noMedia: 'رد على صورة أو فيديو واكتب *.sticker* أو ابعت ميديا مع الأمر.',
      dlFail: 'فشل تحميل الميديا، جرّب تاني.',
      fail: 'فشل تحويل الميديا لستيكر.'
    }
  };

  const T = TXT[lang] || TXT.en;

  let targetMessage = message;

  if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const q = message.message.extendedTextMessage.contextInfo;
    targetMessage = {
      key: {
        remoteJid: chatId,
        id: q.stanzaId,
        participant: q.participant
      },
      message: q.quotedMessage
    };
  }

  const mediaMessage =
    targetMessage.message?.imageMessage ||
    targetMessage.message?.videoMessage ||
    targetMessage.message?.documentMessage;

  if (!mediaMessage) {
    await sock.sendMessage(chatId, { text: T.noMedia }, { quoted: message });
    return;
  }

  try {
    const buffer = await downloadMediaMessage(
      targetMessage,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );

    if (!buffer) {
      await sock.sendMessage(chatId, { text: T.dlFail }, { quoted: message });
      return;
    }

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const base = `stk_${Date.now()}`;
    const input = path.join(tmpDir, `${base}.input`);
    const output = path.join(tmpDir, `${base}.webp`);
    fs.writeFileSync(input, buffer);

    const isAnimated =
      mediaMessage.mimetype?.includes('video') ||
      mediaMessage.mimetype?.includes('gif');

    const ffmpegCmd = isAnimated
      ? `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -loop 0 -pix_fmt yuva420p -quality 60 "${output}"`
      : `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -loop 0 -pix_fmt yuva420p -quality 70 "${output}"`;

    await new Promise((res, rej) => exec(ffmpegCmd, (err) => (err ? rej(err) : res())));

    const webpBuffer = fs.readFileSync(output);

    const img = new webp.Image();
    await img.load(webpBuffer);

    const json = {
      'sticker-pack-id': crypto.randomBytes(16).toString('hex'),
      'sticker-pack-name': settings.packname || 'EasyStep',
      emojis: ['🤖']
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    img.exif = exif;

    const finalBuffer = await img.save(null);

    await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });

    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}
  } catch (e) {
    console.error('STICKER ERROR:', e?.message || e);
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
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
    ar: 'تحويل صورة/فيديو إلى ستيكر.',
    en: 'Convert an image/video to a sticker.'
  },
  usage: {
    ar: '.sticker (رد على ميديا) / ابعت ميديا مع كابشن .sticker',
    en: '.sticker (reply to media) / send media with caption .sticker'
  },
  emoji: '🎨',

  admin: false,
  owner: false,
  showInMenu: true,

  async exec(sock, message, args) {
    return stickerCommand(sock, message, args);
  }
};