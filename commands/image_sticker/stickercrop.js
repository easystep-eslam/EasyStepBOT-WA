const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../../settings');
const webp = require('node-webpmux');
const crypto = require('crypto');
const { getLang } = require('../../lib/lang');

async function stickercropCommand(sock, chatId, message) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      noMedia: 'Reply to an image/video/sticker with *.crop*\nOr send media with caption *.crop*',
      dlFail: 'Failed to download media. Please try again.',
      fail: 'Failed to crop sticker! Try with an image.'
    },
    ar: {
      noMedia: 'رد على صورة/فيديو/ستيكر بـ *.crop*\nأو ابعت ميديا واكتب *.crop* في الكابشن',
      dlFail: 'فشل تحميل الميديا.. جرّب تاني.',
      fail: 'فشل قصّ الستكر! جرّب بصورة.'
    }
  };

  const T = TXT[lang] || TXT.en;

  const messageToQuote = message;
  let targetMessage = message;

  if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const quotedInfo = message.message.extendedTextMessage.contextInfo;
    targetMessage = {
      key: {
        remoteJid: chatId,
        id: quotedInfo.stanzaId,
        participant: quotedInfo.participant
      },
      message: quotedInfo.quotedMessage
    };
  }

  const mediaMessage =
    targetMessage.message?.imageMessage ||
    targetMessage.message?.videoMessage ||
    targetMessage.message?.documentMessage ||
    targetMessage.message?.stickerMessage;

  if (!mediaMessage) {
    await sock.sendMessage(chatId, { text: T.noMedia }, { quoted: messageToQuote });
    return;
  }

  try {
    try { await sock.sendMessage(chatId, { react: { text: '✂️', key: message.key } }); } catch {}

    const mediaBuffer = await downloadMediaMessage(
      targetMessage,
      'buffer',
      {},
      { logger: undefined, reuploadRequest: sock.updateMediaMessage }
    );

    if (!mediaBuffer) {
      await sock.sendMessage(chatId, { text: T.dlFail }, { quoted: messageToQuote });
      return;
    }

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const stamp = Date.now();
    const tempInput = path.join(tmpDir, `crop_in_${stamp}`);
    const tempOutput = path.join(tmpDir, `crop_out_${stamp}.webp`);

    fs.writeFileSync(tempInput, mediaBuffer);

    const isAnimated =
      mediaMessage.mimetype?.includes('gif') ||
      mediaMessage.mimetype?.includes('video') ||
      (mediaMessage.seconds && mediaMessage.seconds > 0);

    const fileSizeKB = mediaBuffer.length / 1024;
    const isLargeFile = fileSizeKB > 5000;

    let ffmpegCommand;

    if (isAnimated) {
      ffmpegCommand = isLargeFile
        ? `ffmpeg -y -i "${tempInput}" -t 2 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 30 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput}"`
        : `ffmpeg -y -i "${tempInput}" -t 3 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=12" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 50 -compression_level 6 -b:v 150k -max_muxing_queue_size 1024 "${tempOutput}"`;
    } else {
      ffmpegCommand =
        `ffmpeg -y -i "${tempInput}" ` +
        `-vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,format=rgba" ` +
        `-c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p ` +
        `-quality 75 -compression_level 6 "${tempOutput}"`;
    }

    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
    });

    if (!fs.existsSync(tempOutput)) throw new Error('FFmpeg failed to create output');

    const webpBuffer = fs.readFileSync(tempOutput);

    const img = new webp.Image();
    await img.load(webpBuffer);

    const json = {
      'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
      'sticker-pack-name': settings.packname || 'EasyStep',
      emojis: ['✂️']
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    img.exif = exif;
    const finalBuffer = await img.save(null);

    await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: messageToQuote });

    try { fs.unlinkSync(tempInput); } catch {}
    try { fs.unlinkSync(tempOutput); } catch {}

  } catch (error) {
    console.error('Error in stickercrop command:', error);
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: messageToQuote });
  }
}

async function stickercropFromBuffer(inputBuffer, isAnimated = false) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const stamp = Date.now();
  const tempInput = path.join(tmpDir, `cropbuf_in_${stamp}`);
  const tempOutput = path.join(tmpDir, `cropbuf_out_${stamp}.webp`);

  fs.writeFileSync(tempInput, inputBuffer);

  const fileSizeKB = inputBuffer.length / 1024;
  const isLargeFile = fileSizeKB > 5000;

  let ffmpegCommand;
  if (isAnimated) {
    ffmpegCommand = isLargeFile
      ? `ffmpeg -y -i "${tempInput}" -t 2 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 30 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput}"`
      : `ffmpeg -y -i "${tempInput}" -t 3 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=12" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 50 -compression_level 6 -b:v 150k -max_muxing_queue_size 1024 "${tempOutput}"`;
  } else {
    ffmpegCommand =
      `ffmpeg -y -i "${tempInput}" ` +
      `-vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,format=rgba" ` +
      `-c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p ` +
      `-quality 75 -compression_level 6 "${tempOutput}"`;
  }

  await new Promise((resolve, reject) => {
    exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
  });

  const webpBuffer = fs.readFileSync(tempOutput);

  const img = new webp.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': settings.packname || 'EasyStep',
    emojis: ['✂️']
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ]);

  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);

  img.exif = exif;
  const finalBuffer = await img.save(null);

  try { fs.unlinkSync(tempInput); } catch {}
  try { fs.unlinkSync(tempOutput); } catch {}

  return finalBuffer;
}

module.exports = {
  name: 'crop',
  aliases: ['crop', 'c', 'قص', 'قص_ستيكر', 'كروب'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'قصّ صورة/فيديو/ستيكر لمربع وتحويله لستيكر.',
    en: 'Crop image/video/sticker to a square and convert to sticker.'
  },
  usage: {
    ar: '.crop (رد على ميديا/ستيكر) أو ابعت ميديا بكابشن .crop',
    en: '.crop (reply to media/sticker) or send media with caption .crop'
  },
  emoji: '✂️🏷️',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: async (sock, message, args) => stickercropCommand(sock, message.key.remoteJid, message, args),
  run: async (sock, chatId, message) => stickercropCommand(sock, chatId, message),
  execute: async (sock, message) => stickercropCommand(sock, message.key.remoteJid, message),

  stickercropFromBuffer
};