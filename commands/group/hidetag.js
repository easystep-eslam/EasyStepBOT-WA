const isAdmin = require('../../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

function getMsgText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

function getQuoted(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  const quoted = ctx?.quotedMessage || null;
  const participant = ctx?.participant || null;
  return { quoted, participant, ctx };
}

function getFileInfoFromDocument(docMsg) {
  const fileName = docMsg?.fileName || 'file';
  const ext = path.extname(fileName) || '';
  const mimetype = docMsg?.mimetype || 'application/octet-stream';
  return { fileName, ext, mimetype };
}

async function downloadMediaToTemp(mediaMsg, mediaType) {
  const stream = await downloadContentFromMessage(mediaMsg, mediaType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  const buffer = Buffer.concat(chunks);
  const tempDir = path.join(process.cwd(), 'temp');
  ensureDir(tempDir);

  let ext = '';
  if (mediaType === 'image') ext = '.jpg';
  else if (mediaType === 'video') ext = '.mp4';
  else if (mediaType === 'audio') ext = '.mp3';
  else ext = '.bin';

  if (mediaType === 'document') {
    const { ext: docExt } = getFileInfoFromDocument(mediaMsg);
    ext = docExt || ext;
  }

  const filePath = path.join(tempDir, `hidetag_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function cleanupLater(filePath) {
  setTimeout(() => {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  }, 3000);
}

async function hidetagCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botAdmin: '❌ Please make the bot an admin first.',
      senderAdmin: '❌ Only group admins can use this command.',
      usage: 'Usage:\n.hidetag <text>\n(or reply to a message)',
      aboveMentionText: 'DM HERE 👇🏻👇🏻',
      error: '❌ Something went wrong while running hidetag.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      senderAdmin: '❌ الأمر ده للأدمنية بس.',
      usage: 'الاستخدام:\n.hidetag <نص>\n(أو رد على رسالة)',
      aboveMentionText: 'ابعتلي هنا 👇🏻👇🏻',
      error: '❌ حصل خطأ أثناء تنفيذ أمر hidetag.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    try {
      await sock.sendMessage(chatId, { react: { text: '👀', key: message.key } });
    } catch {}

    if (!chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
      return;
    }

    const adminCheck = await isAdmin(sock, chatId, senderId);
    const isSenderAdmin = !!adminCheck?.isSenderAdmin;
    const isBotAdmin = !!adminCheck?.isBotAdmin;

    if (!isBotAdmin) {
      await sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });
      return;
    }

    if (!isSenderAdmin && !message.key.fromMe) {
      await sock.sendMessage(chatId, { text: T.senderAdmin }, { quoted: message });
      return;
    }

    const { quoted, participant: repliedUserJid } = getQuoted(message);
    const rawText = getMsgText(message).trim();

    const used = (rawText.split(/\s+/)[0] || 'hidetag').toLowerCase();
    const fromRaw = rawText.slice(used.length).trim();
    const fromArgs = (Array.isArray(args) ? args.join(' ') : '').trim();
    const userText = (fromArgs || fromRaw || '').trim();

    const replyJid = repliedUserJid || senderId;
    const replyNumber = String(replyJid).split('@')[0];
    const visibleReplyLine = `\n\n${T.aboveMentionText}\n📩 @${replyNumber}`;

    const groupMetadata = await sock.groupMetadata(chatId);
    const members = (groupMetadata.participants || []).map(p => p.id).filter(Boolean);
    const mentions = [...new Set([...members, replyJid])];

    let content = null;
    let tempFile = null;

    const msgContent = message.message || {};

    if (msgContent.imageMessage && !quoted) {
      tempFile = await downloadMediaToTemp(msgContent.imageMessage, 'image');
      const originalCaption = msgContent.imageMessage.caption || userText || '';
      content = { image: { url: tempFile }, caption: `${originalCaption}${visibleReplyLine}`.trim(), mentions };
    } else if (msgContent.videoMessage && !quoted) {
      tempFile = await downloadMediaToTemp(msgContent.videoMessage, 'video');
      const originalCaption = msgContent.videoMessage.caption || userText || '';
      content = { video: { url: tempFile }, mimetype: 'video/mp4', caption: `${originalCaption}${visibleReplyLine}`.trim(), mentions };
    } else if (msgContent.documentMessage && !quoted) {
      tempFile = await downloadMediaToTemp(msgContent.documentMessage, 'document');
      const { fileName, mimetype } = getFileInfoFromDocument(msgContent.documentMessage);
      const cap = (userText || '').trim() ? `${userText}${visibleReplyLine}`.trim() : `${visibleReplyLine}`.trim();
      content = { document: { url: tempFile }, fileName, mimetype, caption: cap, mentions };
    } else if (quoted) {
      if (quoted.imageMessage) {
        tempFile = await downloadMediaToTemp(quoted.imageMessage, 'image');
        const originalCaption = quoted.imageMessage.caption || userText || '';
        content = { image: { url: tempFile }, caption: `${originalCaption}${visibleReplyLine}`.trim(), mentions };
      } else if (quoted.videoMessage) {
        tempFile = await downloadMediaToTemp(quoted.videoMessage, 'video');
        const originalCaption = quoted.videoMessage.caption || userText || '';
        content = { video: { url: tempFile }, mimetype: 'video/mp4', caption: `${originalCaption}${visibleReplyLine}`.trim(), mentions };
      } else if (quoted.documentMessage) {
        tempFile = await downloadMediaToTemp(quoted.documentMessage, 'document');
        const { fileName, mimetype } = getFileInfoFromDocument(quoted.documentMessage);
        const cap = (userText || '').trim() ? `${userText}${visibleReplyLine}`.trim() : `${visibleReplyLine}`.trim();
        content = { document: { url: tempFile }, fileName, mimetype, caption: cap, mentions };
      } else {
        const originalText = quoted.conversation || quoted.extendedTextMessage?.text || userText || '';
        const finalText = `${String(originalText || '').trim()}${visibleReplyLine}`.trim();
        content = { text: finalText || T.usage, mentions };
      }
    } else {
      if (!userText) {
        await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
        return;
      }
      content = { text: `${userText}${visibleReplyLine}`.trim(), mentions };
    }

    await sock.sendMessage(chatId, content, { quoted: message });
    if (tempFile) cleanupLater(tempFile);

  } catch (err) {
    console.error('HIDETAG ERROR:', err?.message || err);
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'hidetag',
  aliases: ['hidetag', 'h', 'ht', 'منشن_مخفي', 'م'],
  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },
  description: {
    ar: 'منشن مخفي لكل أعضاء الجروب + منشن ظاهر لشخص واحد (الرد/صاحب الأمر) مع دعم نص/صور/فيديو/ملفات.',
    en: 'Hidden tag for all group members + one visible mention (reply/sender), supports text/media/doc.'
  },
  usage: {
    ar: '.hidetag <نص> (أو رد على رسالة)',
    en: '.hidetag <text> (or reply to a message)'
  },
  emoji: '🗣',

  admin: true,
  owner: false,
  showInMenu: true,
  exec: hidetagCommand,
  run: hidetagCommand,
  execute: hidetagCommand
};