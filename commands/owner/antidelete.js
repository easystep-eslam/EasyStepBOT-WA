const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

const { getLang } = require('../../lib/lang');
const isOwnerOrSudo = require('../../lib/isOwner');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../../data/antidelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../../tmp');

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
  fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

const getFolderSizeInMB = (folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      if (fs.statSync(filePath).isFile()) {
        totalSize += fs.statSync(filePath).size;
      }
    }

    return totalSize / (1024 * 1024);
  } catch {
    return 0;
  }
};

const cleanTempFolderIfLarge = () => {
  try {
    const sizeMB = getFolderSizeInMB(TEMP_MEDIA_DIR);
    if (sizeMB > 200) {
      const files = fs.readdirSync(TEMP_MEDIA_DIR);
      for (const file of files) {
        const filePath = path.join(TEMP_MEDIA_DIR, file);
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  } catch {}
};

setInterval(cleanTempFolderIfLarge, 60 * 1000);

function loadAntideleteConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
    return JSON.parse(fs.readFileSync(CONFIG_PATH));
  } catch {
    return { enabled: false };
  }
}

function saveAntideleteConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch {}
}

function t(chatId, map) {
  const lang = getLang(chatId);
  return map[lang] || map.en || '';
}

async function handleAntideleteCommand(sock, chatId, message, match) {
  const senderId = message.key.participant || message.key.remoteJid;
  const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

  if (!message.key.fromMe && !isOwner) {
    return sock.sendMessage(
      chatId,
      {
        text: t(chatId, {
          en: '*Only the bot owner can use this command.*',
          ar: '*هذا الأمر للمالك فقط.*'
        })
      },
      { quoted: message }
    );
  }

  const config = loadAntideleteConfig();

  if (!match) {
    return sock.sendMessage(
      chatId,
      {
        text: t(chatId, {
          en:
            `*ANTIDELETE SETUP*\n\n` +
            `Current Status: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
            `*.antidelete on* - Enable\n` +
            `*.antidelete off* - Disable`,
          ar:
            `*إعدادات منع الحذف*\n\n` +
            `الحالة الحالية: ${config.enabled ? '✅ مفعل' : '❌ غير مفعل'}\n\n` +
            `*.antidelete on* - تفعيل\n` +
            `*.antidelete off* - إيقاف`
        })
      },
      { quoted: message }
    );
  }

  const m = (match || '').trim().toLowerCase();
  if (m === 'on') {
    config.enabled = true;
  } else if (m === 'off') {
    config.enabled = false;
  } else {
    return sock.sendMessage(
      chatId,
      {
        text: t(chatId, {
          en: '*Invalid command. Use .antidelete to see usage.*',
          ar: '*أمر غير صحيح. اكتب .antidelete لعرض طريقة الاستخدام.*'
        })
      },
      { quoted: message }
    );
  }

  saveAntideleteConfig(config);

  return sock.sendMessage(
    chatId,
    {
      text: t(chatId, {
        en: `*Antidelete ${m === 'on' ? 'enabled' : 'disabled'}*`,
        ar: `*تم ${m === 'on' ? 'تفعيل' : 'إيقاف'} منع الحذف*`
      })
    },
    { quoted: message }
  );
}

async function storeMessage(sock, message) {
  try {
    const chatId = message.key.remoteJid;
    const config = loadAntideleteConfig();
    if (!config.enabled) return;

    if (!message.key?.id) return;

    const messageId = message.key.id;
    let content = '';
    let mediaType = '';
    let mediaPath = '';
    let isViewOnce = false;

    const sender = message.key.participant || message.key.remoteJid;

    const viewOnceContainer =
      message.message?.viewOnceMessageV2?.message ||
      message.message?.viewOnceMessage?.message;

    if (viewOnceContainer) {
      if (viewOnceContainer.imageMessage) {
        mediaType = 'image';
        content = viewOnceContainer.imageMessage.caption || '';
        const buffer = await downloadContentFromMessage(viewOnceContainer.imageMessage, 'image');
        mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
        await writeFile(mediaPath, buffer);
        isViewOnce = true;
      } else if (viewOnceContainer.videoMessage) {
        mediaType = 'video';
        content = viewOnceContainer.videoMessage.caption || '';
        const buffer = await downloadContentFromMessage(viewOnceContainer.videoMessage, 'video');
        mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
        await writeFile(mediaPath, buffer);
        isViewOnce = true;
      }
    } else if (message.message?.conversation) {
      content = message.message.conversation;
    } else if (message.message?.extendedTextMessage?.text) {
      content = message.message.extendedTextMessage.text;
    } else if (message.message?.imageMessage) {
      mediaType = 'image';
      content = message.message.imageMessage.caption || '';
      const buffer = await downloadContentFromMessage(message.message.imageMessage, 'image');
      mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
      await writeFile(mediaPath, buffer);
    } else if (message.message?.stickerMessage) {
      mediaType = 'sticker';
      const buffer = await downloadContentFromMessage(message.message.stickerMessage, 'sticker');
      mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
      await writeFile(mediaPath, buffer);
    } else if (message.message?.videoMessage) {
      mediaType = 'video';
      content = message.message.videoMessage.caption || '';
      const buffer = await downloadContentFromMessage(message.message.videoMessage, 'video');
      mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
      await writeFile(mediaPath, buffer);
    } else if (message.message?.audioMessage) {
      mediaType = 'audio';
      const mime = message.message.audioMessage.mimetype || '';
      const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
      const buffer = await downloadContentFromMessage(message.message.audioMessage, 'audio');
      mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
      await writeFile(mediaPath, buffer);
    }

    messageStore.set(messageId, {
      content,
      mediaType,
      mediaPath,
      sender,
      group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
      timestamp: new Date().toISOString()
    });

    if (isViewOnce && mediaType && fs.existsSync(mediaPath)) {
      try {
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const senderName = sender.split('@')[0];

        const mediaOptions = {
          caption: t(chatId, {
            en: `*Anti-ViewOnce ${mediaType}*\nFrom: @${senderName}`,
            ar: `*مضاد العرض مرة واحدة (${mediaType})*\nمن: @${senderName}`
          }),
          mentions: [sender]
        };

        if (mediaType === 'image') {
          await sock.sendMessage(ownerNumber, { image: { url: mediaPath }, ...mediaOptions });
        } else if (mediaType === 'video') {
          await sock.sendMessage(ownerNumber, { video: { url: mediaPath }, ...mediaOptions });
        }

        try { fs.unlinkSync(mediaPath); } catch {}
      } catch {}
    }
  } catch {}
}

async function handleMessageRevocation(sock, revocationMessage) {
  try {
    const chatId = revocationMessage.key.remoteJid;
    const config = loadAntideleteConfig();
    if (!config.enabled) return;

    const messageId = revocationMessage.message.protocolMessage.key.id;
    const deletedBy =
      revocationMessage.participant ||
      revocationMessage.key.participant ||
      revocationMessage.key.remoteJid;

    const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

    const original = messageStore.get(messageId);
    if (!original) return;

    const sender = original.sender;
    const senderName = sender.split('@')[0];
    const groupName = original.group ? (await sock.groupMetadata(original.group)).subject : '';

    const time = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    let text = t(chatId, {
      en: `*🔰 ANTIDELETE REPORT 🔰*\n\n`,
      ar: `*🔰 تقرير منع الحذف 🔰*\n\n`
    });

    text += t(chatId, {
      en:
        `*🗑️ Deleted By:* @${deletedBy.split('@')[0]}\n` +
        `*👤 Sender:* @${senderName}\n` +
        `*📱 Number:* ${sender}\n` +
        `*🕒 Time:* ${time}\n`,
      ar:
        `*🗑️ تم الحذف بواسطة:* @${deletedBy.split('@')[0]}\n` +
        `*👤 المرسل:* @${senderName}\n` +
        `*📱 الرقم:* ${sender}\n` +
        `*🕒 الوقت:* ${time}\n`
    });

    if (groupName) {
      text += t(chatId, {
        en: `*👥 Group:* ${groupName}\n`,
        ar: `*👥 الجروب:* ${groupName}\n`
      });
    }

    if (original.content) {
      text += t(chatId, {
        en: `\n*💬 Deleted Message:*\n${original.content}`,
        ar: `\n*💬 الرسالة المحذوفة:*\n${original.content}`
      });
    }

    await sock.sendMessage(ownerNumber, {
      text,
      mentions: [deletedBy, sender]
    });

    if (original.mediaType && fs.existsSync(original.mediaPath)) {
      const mediaOptions = {
        caption: t(chatId, {
          en: `*Deleted ${original.mediaType}*\nFrom: @${senderName}`,
          ar: `*تم حذف ${original.mediaType}*\nمن: @${senderName}`
        }),
        mentions: [sender]
      };

      try {
        switch (original.mediaType) {
          case 'image':
            await sock.sendMessage(ownerNumber, { image: { url: original.mediaPath }, ...mediaOptions });
            break;
          case 'sticker':
            await sock.sendMessage(ownerNumber, { sticker: { url: original.mediaPath }, ...mediaOptions });
            break;
          case 'video':
            await sock.sendMessage(ownerNumber, { video: { url: original.mediaPath }, ...mediaOptions });
            break;
          case 'audio':
            await sock.sendMessage(ownerNumber, {
              audio: { url: original.mediaPath },
              mimetype: 'audio/mpeg',
              ptt: false,
              ...mediaOptions
            });
            break;
        }
      } catch (err) {
        await sock.sendMessage(ownerNumber, {
          text: t(chatId, {
            en: `⚠️ Error sending media: ${err.message}`,
            ar: `⚠️ حصل خطأ أثناء إرسال الميديا: ${err.message}`
          })
        });
      }

      try { fs.unlinkSync(original.mediaPath); } catch {}
    }

    messageStore.delete(messageId);
  } catch {}
}

async function antideleteCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;

  await sock.sendMessage(chatId, {
    react: { text: '🔒', key: message.key }
  }).catch(() => {});

  const match = String(args[0] || '').trim();
  return handleAntideleteCommand(sock, chatId, message, match);
}

module.exports = {
  name: 'antidelete',
  aliases: ['antidelete', 'منع_الحذف', 'منع_مسح'],
  category: {

  ar: '👑 أوامر المالك',

  en: '👑 Owner Commands'

},
  description: {
    ar: 'تفعيل أو إيقاف منع الحذف',
    en: 'Enable or disable anti-delete'
  },
  emoji: '🚫🗑️',
  admin: false,
  owner: true,
  showInMenu: true,
  exec: antideleteCommand,
  handleAntideleteCommand,
  handleMessageRevocation,
  storeMessage
};