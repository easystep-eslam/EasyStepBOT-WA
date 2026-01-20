const axios = require('axios');

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const { uploadImage } = require('../../lib/uploadImage');

const { getLang } = require('../../lib/lang');

const timers = new Map();

const AXIOS_DEFAULTS = {

  timeout: 60000,

  headers: {

    'User-Agent':

      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    Accept: '*/*'

  }

};

async function safeReact(sock, chatId, key, emoji) {

  try {

    if (!key) return;

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

async function getQuotedOrOwnImageUrl(message) {

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

async function reminiCommand(sock, message, args = []) {

  const chatId = message?.key?.remoteJid;

  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {

    en: {

      invalidUrl: '❌ Invalid URL provided.\n\nUsage: `remini https://example.com/image.jpg`',

      usage:

        '📸 *Remini AI Enhancement*\n\n' +

        'Usage:\n' +

        '• `remini <image_url>`\n' +

        '• Reply to an image with `remini`\n' +

        '• Send an image with caption `remini`\n\n' +

        'Example: `remini https://example.com/image.jpg`',

      processing: '✨ Enhancing image... please wait.',

      success: '✨ *Image enhanced successfully!*\n\nENHANCED BY EASYSTEP-BOT',

      fail: '❌ Failed to enhance image.',

      rate: '⏰ Rate limit exceeded. Please try again later.',

      bad: '❌ Invalid image URL or format.',

      server: '🔧 Server error. Please try again later.',

      timeout: '⏰ Request timeout. Please try again.',

      net: '🌐 Network error. Please check your connection.',

      processFail: '❌ Image processing failed. Try a different image.'

    },

    ar: {

      invalidUrl: '❌ الرابط اللي بعته مش صحيح.\n\nالاستخدام: `remini https://example.com/image.jpg`',

      usage:

        '📸 *تحسين الصورة - Remini AI*\n\n' +

        'الاستخدام:\n' +

        '• `remini <رابط_الصورة>`\n' +

        '• رد على صورة واكتب `remini`\n' +

        '• ابعت صورة مع كابشن `remini`\n\n' +

        'مثال: `remini https://example.com/image.jpg`',

      processing: '✨ جاري تحسين الصورة... برجاء الانتظار.',

      success: '✨ *تم تحسين الصورة بنجاح!*\n\nENHANCED BY EASYSTEP-BOT',

      fail: '❌ فشل تحسين الصورة.',

      rate: '⏰ تم تجاوز الحد. حاول مرة أخرى لاحقًا.',

      bad: '❌ رابط الصورة أو صيغة الصورة غير صحيحة.',

      server: '🔧 مشكلة في السيرفر. حاول مرة أخرى لاحقًا.',

      timeout: '⏰ انتهت مهلة الطلب. حاول مرة أخرى.',

      net: '🌐 مشكلة في الاتصال. تأكد من الإنترنت.',

      processFail: '❌ فشل معالجة الصورة. جرّب صورة مختلفة.'

    }

  };

  const T = TXT[lang] || TXT.en;

  try {

    await safeReact(sock, chatId, message.key, '✨');

    let imageUrl = null;

    if (Array.isArray(args) && args.length > 0) {

      const url = args.join(' ').trim();

      if (!isValidUrl(url)) {

        await safeReact(sock, chatId, message.key, '❌');

        await sock.sendMessage(chatId, { text: T.invalidUrl }, { quoted: message });

        return;

      }

      imageUrl = url;

    } else {

      imageUrl = await getQuotedOrOwnImageUrl(message);

      if (!imageUrl) {

        await safeReact(sock, chatId, message.key, '❌');

        await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });

        return;

      }

    }

    await sock.sendMessage(chatId, { text: T.processing }, { quoted: message });

    const apiUrl = `https://api.princetechn.com/api/tools/remini?apikey=prince_tech_api_azfsbshfb&url=${encodeURIComponent(

      imageUrl

    )}`;

    const response = await axios.get(apiUrl, AXIOS_DEFAULTS);

    const result = response?.data?.result;

    if (response?.data?.success && result?.image_url) {

      const imageResponse = await axios.get(result.image_url, {

        responseType: 'arraybuffer',

        timeout: 30000,

        headers: { 'Accept-Encoding': 'identity' },

        validateStatus: (s) => s >= 200 && s < 400

      });

      if (imageResponse?.data) {

        await sock.sendMessage(

          chatId,

          { image: Buffer.from(imageResponse.data), caption: T.success },

          { quoted: message }

        );

        await safeReact(sock, chatId, message.key, '✅');

        return;

      }

      throw new Error('Enhanced image download failed');

    }

    throw new Error(result?.message || 'API returned invalid response');

  } catch (error) {

    console.error('[REMINI]', error?.stack || error);

    let errorMessage = T.fail;

    const status = error?.response?.status;

    if (status === 429) errorMessage = T.rate;

    else if (status === 400) errorMessage = T.bad;

    else if (status === 500) errorMessage = T.server;

    else if (error?.code === 'ECONNABORTED') errorMessage = T.timeout;

    else if (

      String(error?.message || '').includes('ENOTFOUND') ||

      String(error?.message || '').includes('ECONNREFUSED')

    ) {

      errorMessage = T.net;

    } else if (String(error?.message || '').includes('Error processing image')) {

      errorMessage = T.processFail;

    }

    await safeReact(sock, chatId, message.key, '❌');

    await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });

  }

}

module.exports = {

  name: 'remini',

  aliases: ['enhance', 'hd', 'وضح', 'وضّح', 'تحسين'],

  category: {

    ar: '🎨 أوامر الصور والستيكر',

    en: '🎨 Image & Sticker Commands'

  },

  description: {

    ar: 'تحسين جودة الصور باستخدام Remini AI (برابط أو بالرد على صورة).',

    en: 'Enhance image quality using Remini AI (by URL or by replying to an image).'

  },

  usage: {

    ar: 'remini <رابط_صورة> أو رد على صورة واكتب remini',

    en: 'remini <image_url> or reply to an image and type remini'

  },

  admin: false,

  owner: false,

  showInMenu: true,

  emoji: '✨',

  exec: reminiCommand,

  run: reminiCommand,

  execute: reminiCommand

};