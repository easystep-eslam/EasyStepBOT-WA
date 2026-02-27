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
  const msg = message?.message || {};
  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    ''
  );
}

function getContextInfo(message) {
  const msg = message?.message || {};
  return (
    msg?.extendedTextMessage?.contextInfo ||
    msg?.imageMessage?.contextInfo ||
    msg?.videoMessage?.contextInfo ||
    msg?.documentMessage?.contextInfo ||
    msg?.audioMessage?.contextInfo ||
    {}
  );
}

function getQuoted(message) {
  const ctx = getContextInfo(message);
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

/* 🔥 إزالة الأمر من أي نص */
function stripCmd(text = '') {
  const t = String(text || '').trim();
  return t.replace(/^\.(hidetag|ht|h|منشن_مخفي|م)\b\s*/i, '').trim();
}

async function downloadMediaToTemp(mediaMsg, mediaType) {
  const stream = await downloadContentFromMessage(mediaMsg, mediaType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  const buffer = Buffer.concat(chunks);
  const tempDir = path.join(process.cwd(), 'temp');
  ensureDir(tempDir);

  let ext = '.bin';
  if (mediaType === 'image') ext = '.jpg';
  else if (mediaType === 'video') ext = '.mp4';
  else if (mediaType === 'audio') ext = '.mp3';
  else if (mediaType === 'document') {
    const { ext: docExt } = getFileInfoFromDocument(mediaMsg);
    ext = docExt || '.bin';
  }

  const filePath = path.join(
    tempDir,
    `hidetag_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`
  );

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
    await sock.sendMessage(chatId, { react: { text: '🗣', key: message.key } }).catch(() => {});

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    }

    const adminCheck = await isAdmin(sock, chatId, senderId);
    if (!adminCheck?.isBotAdmin)
      return sock.sendMessage(chatId, { text: T.botAdmin }, { quoted: message });

    if (!adminCheck?.isSenderAdmin && !message.key.fromMe)
      return sock.sendMessage(chatId, { text: T.senderAdmin }, { quoted: message });

    const { quoted, participant: repliedUserJid } = getQuoted(message);

    /* 🔥 استخراج النص بدون الأمر نهائيًا */
    const rawText = getMsgText(message);
    const argsText = Array.isArray(args) ? args.join(' ') : '';

    const userText =
      stripCmd(argsText) ||
      stripCmd(rawText) ||
      '';

    const replyJid = repliedUserJid || senderId;
    const replyNumber = replyJid.split('@')[0];

    const visibleReplyLine = `\n\n${T.aboveMentionText}\n📩 @${replyNumber}`;

    const groupMetadata = await sock.groupMetadata(chatId);
    const members = groupMetadata.participants.map(p => p.id);
    const mentions = [...new Set([...members, replyJid])];

    let content = null;
    let tempFile = null;

    const msgContent = message.message || {};

    /* ====== لو الرسالة فيها ميديا مباشرة ====== */

    if (msgContent.imageMessage && !quoted) {
      tempFile = await downloadMediaToTemp(msgContent.imageMessage, 'image');
      const cap = stripCmd(msgContent.imageMessage.caption || '') || userText;

      content = {
        image: { url: tempFile },
        caption: `${cap}${visibleReplyLine}`.trim(),
        mentions
      };

    } else if (msgContent.videoMessage && !quoted) {
      tempFile = await downloadMediaToTemp(msgContent.videoMessage, 'video');
      const cap = stripCmd(msgContent.videoMessage.caption || '') || userText;

      content = {
        video: { url: tempFile },
        mimetype: 'video/mp4',
        caption: `${cap}${visibleReplyLine}`.trim(),
        mentions
      };

    } else if (msgContent.documentMessage && !quoted) {
      tempFile = await downloadMediaToTemp(msgContent.documentMessage, 'document');
      const { fileName, mimetype } = getFileInfoFromDocument(msgContent.documentMessage);

      const cap = stripCmd(msgContent.documentMessage.caption || '') || userText;

      content = {
        document: { url: tempFile },
        fileName,
        mimetype,
        caption: `${cap}${visibleReplyLine}`.trim(),
        mentions
      };

    /* ====== لو رد على رسالة ====== */

    } else if (quoted) {

      if (quoted.imageMessage) {
        tempFile = await downloadMediaToTemp(quoted.imageMessage, 'image');
        const cap = stripCmd(quoted.imageMessage.caption || '') || userText;

        content = {
          image: { url: tempFile },
          caption: `${cap}${visibleReplyLine}`.trim(),
          mentions
        };

      } else if (quoted.videoMessage) {
        tempFile = await downloadMediaToTemp(quoted.videoMessage, 'video');
        const cap = stripCmd(quoted.videoMessage.caption || '') || userText;

        content = {
          video: { url: tempFile },
          mimetype: 'video/mp4',
          caption: `${cap}${visibleReplyLine}`.trim(),
          mentions
        };

      } else if (quoted.documentMessage) {
        tempFile = await downloadMediaToTemp(quoted.documentMessage, 'document');
        const { fileName, mimetype } = getFileInfoFromDocument(quoted.documentMessage);

        const cap = stripCmd(quoted.documentMessage.caption || '') || userText;

        content = {
          document: { url: tempFile },
          fileName,
          mimetype,
          caption: `${cap}${visibleReplyLine}`.trim(),
          mentions
        };

      } else {
        const originalText =
          stripCmd(
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            ''
          ) || userText;

        content = {
          text: `${originalText}${visibleReplyLine}`.trim(),
          mentions
        };
      }

    /* ====== نص عادي ====== */

    } else {
      if (!userText)
        return sock.sendMessage(chatId, { text: T.usage }, { quoted: message });

      content = {
        text: `${userText}${visibleReplyLine}`.trim(),
        mentions
      };
    }

    await sock.sendMessage(chatId, content, { quoted: message });
    if (tempFile) cleanupLater(tempFile);

  } catch (err) {
    console.error('HIDETAG ERROR:', err);
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
    ar: 'منشن مخفي لكل أعضاء الجروب + منشن ظاهر لشخص واحد.',
    en: 'Hidden tag for all group members + one visible mention.'
  },
  usage: {
    ar: '.hidetag <نص>',
    en: '.hidetag <text>'
  },
  emoji: '🗣',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: hidetagCommand
};
