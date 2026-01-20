/**
 * simage
 * Convert sticker to image (PNG).
 */

const sharp = require('sharp');
const fs = require('fs');
const fsPromises = require('fs/promises');
const fse = require('fs-extra');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getLang } = require('../../lib/lang');

const tmpDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function scheduleFileDeletion(filePath) {
  setTimeout(async () => {
    try {
      await fse.remove(filePath);
    } catch (error) {
      console.error('[SIMAGE] Failed to delete file:', error?.message || error);
    }
  }, 60 * 1000);
}

async function simageCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      needReply: '❌ Reply to a sticker with *.simage* to convert it.',
      done: '✅ Here is the converted image! 🖼️',
      fail: '❌ Failed to convert sticker. Please try again.'
    },
    ar: {
      needReply: '❌ لازم ترد على *استيكر* وتكتب *.simage* عشان أحوله لصورة.',
      done: '✅ اتفضل الصورة بعد التحويل 🖼️',
      fail: '❌ حصل خطأ أثناء تحويل الاستيكر.. جرّب تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerMessage = quoted?.stickerMessage;

    if (!stickerMessage) {
      await sock.sendMessage(chatId, { text: T.needReply }, { quoted: message });
      return;
    }

    const stickerFilePath = path.join(tmpDir, `sticker_${Date.now()}.webp`);
    const outputImagePath = path.join(tmpDir, `converted_${Date.now()}.png`);

    const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    await fsPromises.writeFile(stickerFilePath, buffer);
    await sharp(stickerFilePath).png().toFile(outputImagePath);

    const imageBuffer = await fsPromises.readFile(outputImagePath);

    await sock.sendMessage(
      chatId,
      { image: imageBuffer, caption: T.done },
      { quoted: message }
    );

    scheduleFileDeletion(stickerFilePath);
    scheduleFileDeletion(outputImagePath);
  } catch (error) {
    console.error('[SIMAGE] Error:', error?.message || error);
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'simage',
  aliases: ['simage', 'sticker2img', 'st2img', 'toimg', 'صورة', 'تحويل_استيكر', 'استيكر_لصورة', 'حول_استيكر', 'سيمج'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'تحويل الاستيكر لصورة PNG.',
    en: 'Convert a sticker to a PNG image.'
  },
  usage: {
    ar: '.simage (رد على استيكر)',
    en: '.simage (reply to a sticker)'
  },
  emoji: '🔄🖼️',
  admin: false,
  owner: false,
  showInMenu: true,

  async exec(sock, message) {
    return simageCommand(sock, message);
  }
};