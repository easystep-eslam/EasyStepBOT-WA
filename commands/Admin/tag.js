const isAdmin = require('../../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function downloadToBuffer(mediaMessage, mediaType) {
  const stream = await downloadContentFromMessage(mediaMessage, mediaType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botAdmin: '❌ Please make the bot an admin first.',
      adminOnly: '❌ Only group admins can use this command.',
      tagged: '📣 Tagged everyone.',
      error: '❌ Failed to tag members.'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      botAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      adminOnly: '❌ الأمر ده للأدمنية بس.',
      tagged: '📣 تم منشن الكل.',
      error: '❌ حصل خطأ في أمر المنشن.'
    }
  };
  return { lang, T: dict[lang] || dict.en };
}

async function tagCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message.key, '📣');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  let adminStatus;
  try {
    adminStatus = await isAdmin(sock, chatId, senderId);
  } catch {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });
    return;
  }

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    const stickerPath = path.join(process.cwd(), 'assets', 'sticktag.webp');
    await safeReact(sock, chatId, message.key, '🚫');
    if (fs.existsSync(stickerPath)) {
      try {
        const stickerBuffer = fs.readFileSync(stickerPath);
        await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });
      } catch {}
    } else {
      await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    }
    return;
  }

  const rawText = getText(message).trim();
  const used = (rawText.split(/\s+/)[0] || 'tag').toLowerCase();
  const messageText = rawText.slice(used.length).trim();

  let mentionedJidList = [];
  try {
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants || [];
    mentionedJidList = participants.map(p => p.id).filter(Boolean);
  } catch {
    mentionedJidList = [];
  }

  const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

  try {
    if (replyMessage) {
      let messageContent = null;

      if (replyMessage.imageMessage) {
        const imgBuf = await downloadToBuffer(replyMessage.imageMessage, 'image');
        messageContent = {
          image: imgBuf,
          caption: messageText || replyMessage.imageMessage.caption || '',
          mentions: mentionedJidList
        };
      } else if (replyMessage.videoMessage) {
        const vidBuf = await downloadToBuffer(replyMessage.videoMessage, 'video');
        messageContent = {
          video: vidBuf,
          caption: messageText || replyMessage.videoMessage.caption || '',
          mentions: mentionedJidList
        };
      } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
        const txt = replyMessage.conversation || replyMessage.extendedTextMessage?.text || '';
        messageContent = {
          text: messageText || txt || T.tagged,
          mentions: mentionedJidList
        };
      } else if (replyMessage.documentMessage) {
        const docBuf = await downloadToBuffer(replyMessage.documentMessage, 'document');
        messageContent = {
          document: docBuf,
          fileName: replyMessage.documentMessage.fileName || 'file',
          mimetype: replyMessage.documentMessage.mimetype || 'application/octet-stream',
          caption: messageText || '',
          mentions: mentionedJidList
        };
      } else if (replyMessage.audioMessage) {
        const audBuf = await downloadToBuffer(replyMessage.audioMessage, 'audio');
        messageContent = {
          audio: audBuf,
          mimetype: replyMessage.audioMessage.mimetype || 'audio/mpeg',
          ptt: !!replyMessage.audioMessage.ptt,
          mentions: mentionedJidList
        };
      } else if (replyMessage.stickerMessage) {
        const stBuf = await downloadToBuffer(replyMessage.stickerMessage, 'sticker');
        messageContent = {
          sticker: stBuf,
          mentions: mentionedJidList
        };
      }

      if (messageContent) {
        await safeReact(sock, chatId, message.key, '✅');
        await sock.sendMessage(chatId, messageContent, { quoted: message });
        return;
      }
    }

    await safeReact(sock, chatId, message.key, '✅');
    await sock.sendMessage(
      chatId,
      { text: messageText || T.tagged, mentions: mentionedJidList },
      { quoted: message }
    );
  } catch (err) {
    console.error('Error in tag command:', err);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'tag',
  aliases: ['tag', 'tagall', 'mentionall', 'منشن', 'منشن_الكل', 'تاگ', 'تاج', 'تاج_الكل'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'منشن لكل أعضاء الجروب. يدعم النص أو إعادة إرسال نفس نوع رسالة الريلاي مع منشن للكل.',
    en: 'Mention all group members. Supports text or re-sending replied message type with mentions.'
  },
  usage: {
    ar: '.tag [نص] (أو ريبلاي على رسالة/ميديا)',
    en: '.tag [text] (or reply to a message/media)'
  },
  emoji: '📢',
  admin: true,
  owner: false,
  showInMenu: true,
  run: tagCommand,
  exec: tagCommand,
  execute: (sock, message, args) => tagCommand(sock, message, args),
  tagCommand
};