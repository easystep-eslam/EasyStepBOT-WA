const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const webp = require('node-webpmux');
const crypto = require('crypto');
const { getLang } = require('../../lib/lang');

// Command: take
// AR: سحب/تغيير اسم باك الاستيكر (reply على ستيكر) + اختيار packname
// EN: Steal sticker / change sticker pack name (reply to a sticker) + optional packname

async function takeCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage:
        '🧩 *Take Sticker*\n' +
        'Reply to a sticker with:\n' +
        '*.take <packname>*\n\n' +
        'Example:\n.take EasyStep Pack',
      processing: '⏳ Processing sticker...',
      dlFail: '❌ Failed to download sticker.',
      procFail: '❌ Error processing sticker.',
      cmdFail: '❌ Error processing command.'
    },
    ar: {
      usage:
        '🧩 *أخذ/تعديل باك الاستيكر*\n' +
        'رد على ملصق واكتب:\n' +
        '*.take <اسم الحزمة>*\n\n' +
        'مثال:\n.take EasyStep Pack',
      processing: '⏳ جاري معالجة الملصق...',
      dlFail: '❌ فشل تحميل الملصق.',
      procFail: '❌ حصل خطأ أثناء معالجة الملصق.',
      cmdFail: '❌ حصل خطأ أثناء تنفيذ الأمر.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) {
      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
      return;
    }

    const packname =
      (Array.isArray(args) && args.length ? args.join(' ').trim() : '') ||
      'EasyStep Bot';

    try {
      await sock.sendMessage(chatId, { text: T.processing }, { quoted: message });
    } catch {}

    // Build target message from quoted
    const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
    const targetMessage = {
      key: {
        remoteJid: chatId,
        id: quotedInfo?.stanzaId,
        participant: quotedInfo?.participant
      },
      message: quoted
    };

    let stickerBuffer = null;
    try {
      stickerBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage }
      );
    } catch (e) {
      console.error('Download sticker error:', e?.message || e);
    }

    if (!stickerBuffer) {
      await sock.sendMessage(chatId, { text: T.dlFail }, { quoted: message });
      return;
    }

    try {
      const img = new webp.Image();
      await img.load(stickerBuffer);

      const json = {
        'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
        'sticker-pack-name': packname,
        emojis: ['🤖']
      };

      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00,
        0x00, 0x00
      ]);

      const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
      const exif = Buffer.concat([exifAttr, jsonBuffer]);
      exif.writeUIntLE(jsonBuffer.length, 14, 4);

      img.exif = exif;

      const finalBuffer = await img.save(null);

      await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });
    } catch (e) {
      console.error('Sticker processing error:', e?.message || e);
      await sock.sendMessage(chatId, { text: T.procFail }, { quoted: message });
      return;
    }
  } catch (e) {
    console.error('Error in take command:', e?.message || e);
    await sock.sendMessage(chatId, { text: T.cmdFail }, { quoted: message });
  }
}

module.exports = {
  name: 'take',
  aliases: ['take', 'steal', 'wm', 'حقوق', 'سرقة', 'هات', 'باك'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'تغيير اسم باك الاستيكر (Reply على ستيكر) مع اسم اختياري للحزمة.',
    en: 'Change sticker pack name (reply to a sticker) with an optional packname.'
  },
  usage: {
    ar: '.take <اسم الحزمة> (رد على ستيكر)',
    en: '.take <packname> (reply to a sticker)'
  },
  emoji: '✏️🏷️',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: takeCommand,
  run: takeCommand,
  execute: takeCommand
};