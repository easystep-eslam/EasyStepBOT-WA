const axios = require('axios');

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const { uploadImage } = require('../../lib/uploadImage');

const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, key, emoji) {

  try {

    if (!key) return;

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

async function getImageUrl(message) {

  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quoted?.imageMessage) {

    const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');

    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    return uploadImage(Buffer.concat(chunks));

  }

  if (message.message?.imageMessage) {

    const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');

    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    return uploadImage(Buffer.concat(chunks));

  }

  return null;

}

function isValidUrl(str) {

  try {

    new URL(str);

    return true;

  } catch {

    return false;

  }

}

async function removebgCommand(sock, message, args = []) {

  const chatId = message?.key?.remoteJid;

  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {

    en: {

      usage:

        '🖼️ *Remove Background*\n\n' +

        'Usage:\n' +

        '• `removebg <image_url>`\n' +

        '• Reply to an image with `removebg`\n' +

        '• Send image with caption `removebg`',

      processing: '✂️ Removing background... please wait.',

      success: '✅ Background removed successfully.',

      fail: '❌ Failed to remove background.',

      invalid: '❌ Invalid image URL.',

      server: '🔧 Server error. Try again later.',

      timeout: '⏰ Request timeout.',

      net: '🌐 Network error.'

    },

    ar: {

      usage:

        '🖼️ *إزالة الخلفية*\n\n' +

        'الاستخدام:\n' +

        '• `removebg <رابط_صورة>`\n' +

        '• رد على صورة واكتب `removebg`\n' +

        '• ابعت صورة مع كابشن `removebg`',

      processing: '✂️ جاري إزالة الخلفية... انتظر.',

      success: '✅ تم إزالة الخلفية بنجاح.',

      fail: '❌ فشل إزالة الخلفية.',

      invalid: '❌ رابط الصورة غير صحيح.',

      server: '🔧 خطأ في السيرفر.',

      timeout: '⏰ انتهت مهلة الطلب.',

      net: '🌐 مشكلة في الاتصال.'

    }

  };

  const T = TXT[lang] || TXT.en;

  try {

    await safeReact(sock, chatId, message.key, '✂️');

    let imageUrl = null;

    if (Array.isArray(args) && args.length > 0) {

      const url = args.join(' ').trim();

      if (!isValidUrl(url)) {

        await safeReact(sock, chatId, message.key, '❌');

        await sock.sendMessage(chatId, { text: T.invalid }, { quoted: message });

        return;

      }

      imageUrl = url;

    } else {

      imageUrl = await getImageUrl(message);

      if (!imageUrl) {

        await safeReact(sock, chatId, message.key, '❌');

        await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });

        return;

      }

    }

    await sock.sendMessage(chatId, { text: T.processing }, { quoted: message });

    const apiUrl = `https://api.princetechn.com/api/tools/removebg?apikey=prince_tech_api_azfsbshfb&url=${encodeURIComponent(

      imageUrl

    )}`;

    const response = await axios.get(apiUrl, { timeout: 60000 });

    const result = response?.data?.result;

    if (response?.data?.success && result?.image_url) {

      const img = await axios.get(result.image_url, {

        responseType: 'arraybuffer',

        timeout: 30000

      });

      await sock.sendMessage(

        chatId,

        { image: Buffer.from(img.data), caption: T.success },

        { quoted: message }

      );

      await safeReact(sock, chatId, message.key, '✅');

      return;

    }

    throw new Error('RemoveBG API failed');

  } catch (error) {

    console.error('[REMOVEBG]', error?.stack || error);

    let msg = T.fail;

    if (error?.code === 'ECONNABORTED') msg = T.timeout;

    else if (

      String(error?.message || '').includes('ENOTFOUND') ||

      String(error?.message || '').includes('ECONNREFUSED')

    ) {

      msg = T.net;

    } else if (error?.response?.status === 500) {

      msg = T.server;

    }

    await safeReact(sock, chatId, message.key, '❌');

    await sock.sendMessage(chatId, { text: msg }, { quoted: message });

  }

}

module.exports = {

  name: 'removebg',

  aliases: ['bgremove', 'cutbg', 'قص', 'قص_الخلفية'],

  category: {

    ar: '🎨 أوامر الصور والستيكر',

    en: '🎨 Image & Sticker Commands'

  },

  description: {

    ar: 'إزالة خلفية الصورة تلقائيًا (برابط أو بالرد على صورة).',

    en: 'Remove image background automatically (by URL or reply).'

  },

  usage: {

    ar: 'removebg <رابط_صورة> أو رد على صورة واكتب removebg',

    en: 'removebg <image_url> or reply to an image and type removebg'

  },

  admin: false,

  owner: false,

  showInMenu: true,

  emoji: '✂️',

  exec: removebgCommand,

  run: removebgCommand,

  execute: removebgCommand

};