const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const { getLang } = require('../../lib/lang');

async function blurCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage: '❌ Please reply to an image or send an image with caption *.blur*',
      replyToImage: '❌ Please reply to an image message',
      success: '✅ Image blurred successfully!',
      failed: '❌ Failed to blur image. Please try again later.'
    },
    ar: {
      usage: '❌ لازم ترد على صورة أو تبعت صورة وتكتب في الكابشن *.blur*',
      replyToImage: '❌ لازم ترد على رسالة فيها صورة',
      success: '✅ تم تمويه الصورة بنجاح!',
      failed: '❌ حصلت مشكلة في تمويه الصورة. جرّب تاني بعد شوية.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await sock.sendMessage(chatId, {
      react: { text: '🌫️', key: message.key }
    }).catch(() => {});

    let imageBuffer = null;

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quoted?.imageMessage) {
      const quotedMsg = { message: { imageMessage: quoted.imageMessage } };
      imageBuffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, {});
    } else if (message.message?.imageMessage) {
      imageBuffer = await downloadMediaMessage(message, 'buffer', {}, {});
    } else {
      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
      return;
    }

    if (!imageBuffer) {
      await sock.sendMessage(chatId, { text: T.replyToImage }, { quoted: message });
      return;
    }

    const resizedImage = await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const blurredImage = await sharp(resizedImage).blur(10).toBuffer();

    await sock.sendMessage(
      chatId,
      { image: blurredImage, caption: T.success },
      { quoted: message }
    );
  } catch (error) {
    console.error('Error in blur command:', error);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'blur',
  aliases: ['blur', 'تمويه', 'blurimg'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'تمويه/تغبيش صورة (بالرد أو بإرسال صورة مع كابشن).',
    en: 'Blur an image (reply to an image or send one with caption).'
  },
  usage: {
    ar: '.blur (رد على صورة) / ابعت صورة بكابشن .blur',
    en: '.blur (reply to image) / send image with caption .blur'
  },
  emoji: '🌫️',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: blurCommand,
  run: blurCommand,
  execute: blurCommand
};