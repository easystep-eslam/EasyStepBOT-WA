const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TT(chatId) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      ownerOnly: '❌ This command is only available for the owner!',
      replyImage: '⚠️ Reply to an image/sticker then type: setpp',
      mustBeImage: '❌ The replied message must contain an image or sticker!',
      success: '✅ Bot profile picture updated successfully!',
      fail: '❌ Failed to update profile picture!'
    },
    ar: {
      ownerOnly: '❌ الأمر ده للمالك فقط!',
      replyImage: '⚠️ رد على صورة/ملصق ثم اكتب: setpp',
      mustBeImage: '❌ لازم الرسالة اللي بترد عليها تكون صورة أو ملصق!',
      success: '✅ تم تغيير صورة البوت بنجاح!',
      fail: '❌ حصل خطأ أثناء تغيير صورة البوت!'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

async function setppCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const { T } = TT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '🖼️');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const owner = message.key.fromMe || (await isOwnerOrSudo(senderId, sock, chatId));

    if (!owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMessage) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.replyImage }, { quoted: message });
      return;
    }

    const imageMsg = quotedMessage.imageMessage || null;
    const stickerMsg = quotedMessage.stickerMessage || null;

    if (!imageMsg && !stickerMsg) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.mustBeImage }, { quoted: message });
      return;
    }

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const dlType = imageMsg ? 'image' : 'sticker';
    const targetMsg = imageMsg || stickerMsg;

    const stream = await downloadContentFromMessage(targetMsg, dlType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const imagePath = path.join(tmpDir, `profile_${Date.now()}.jpg`);
    fs.writeFileSync(imagePath, buffer);

    await sock.updateProfilePicture(sock.user.id, { url: imagePath });

    try { fs.unlinkSync(imagePath); } catch {}

    await safeReact(sock, chatId, message.key, '✅');
    await sock.sendMessage(chatId, { text: T.success }, { quoted: message });
  } catch (error) {
    console.error('[SETPP]', error?.stack || error);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: TT(message?.key?.remoteJid || '').T.fail }, { quoted: message }).catch(() => {});
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'setpp',
  aliases: ['setpp', 'pp', 'setpfp', 'setavatar'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'تغيير صورة البوت عن طريق الرد على صورة/ملصق.',
    en: 'Change the bot profile picture by replying to an image/sticker.'
  },
  usage: {
    ar: 'setpp (رد على صورة/ملصق)',
    en: 'setpp (reply to an image/sticker)'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '🖼️',
  exec: setppCommand,
  run: setppCommand,
  execute: setppCommand,

  setppCommand
};
