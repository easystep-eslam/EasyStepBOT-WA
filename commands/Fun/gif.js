const axios = require('axios');
const settings = require('../../settings');
const { getLang } = require('../../lib/lang');

/*
📝 Command Info
────────────────
Name      : gif
Description:
• Search & send a GIF from Giphy
• Usage: .gif <query>
Notes:
• Requires settings.giphyApiKey
*/

function extractText(message) {
  return (
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    ''
  );
}

async function gifCommand(sock, chatId, message) {
  const lang = getLang(chatId);
  const apiKey = settings.giphyApiKey;

  const T = {
    react: { en: '🎬', ar: '🎬' },
    needQuery: {
      en: '❌ Please provide a search term.\nExample: .gif cat',
      ar: '❌ من فضلك اكتب كلمة نبحث بيها.\nمثال: .gif قطة'
    },
    notFound: {
      en: '❌ No GIFs found for this search term.',
      ar: '❌ ملقيناش GIF مناسب للكلمة دي.'
    },
    noKey: {
      en: '❌ Giphy API key is missing in settings (settings.giphyApiKey).',
      ar: '❌ مفتاح Giphy مش موجود في settings (settings.giphyApiKey).'
    },
    failed: {
      en: '❌ Failed to fetch GIF. Please try again later.',
      ar: '❌ فشلنا نجيب GIF دلوقتي، جرّب تاني بعد شوية.'
    },
    caption: {
      en: (q) => `🎞️ GIF for: "${q}"`,
      ar: (q) => `🎞️ GIF للكلمة: "${q}"`
    }
  };

  // React مناسب
  try {
    await sock.sendMessage(chatId, {
      react: { text: T.react[lang] || T.react.en, key: message.key }
    }).catch(() => {});
  } catch {}

  // Extract query (supports handlers that don't pass args)
  const raw = extractText(message);
  const used = (raw || '').split(/\s+/)[0] || 'gif';
  const query = raw.slice(used.length).trim();

  if (!query) {
    await sock.sendMessage(chatId, { text: T.needQuery[lang] || T.needQuery.en }, { quoted: message });
    return;
  }

  if (!apiKey) {
    await sock.sendMessage(chatId, { text: T.noKey[lang] || T.noKey.en }, { quoted: message });
    return;
  }

  try {
    const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
      params: {
        api_key: apiKey,
        q: query,
        limit: 1,
        rating: 'g'
      },
      timeout: 15000,
      headers: { 'User-Agent': 'EasyStep-BOT' }
    });

    const gifUrl = response.data?.data?.[0]?.images?.downsized_medium?.url;

    if (!gifUrl) {
      await sock.sendMessage(chatId, { text: T.notFound[lang] || T.notFound.en }, { quoted: message });
      return;
    }

    await sock.sendMessage(
      chatId,
      {
        video: { url: gifUrl },
        caption: (T.caption[lang] || T.caption.en)(query),
        gifPlayback: true
      },
      { quoted: message }
    );

  } catch (error) {
    console.error('[GIF] Error:', error?.message || error);
    await sock.sendMessage(chatId, { text: T.failed[lang] || T.failed.en }, { quoted: message });
  }
}

/*
✅ Wrapper للأوتولودر (يدعم كل أنظمة التشغيل عندكم)
*/
async function gifExec(sock, message) {
  const chatId = message.key.remoteJid;
  return gifCommand(sock, chatId, message);
}

module.exports = {
  // ✅ القاعدة الذهبية: metadata في الآخر

  name: 'gif',

  // aliases بدون نقطة (يفضل) + دعم العربي/الإنجليزي
  aliases: ['gif', 'جيف', 'صور_متحركة', 'gifsearch', 'giphy'],

  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },

  description: {
    ar: 'بحث وإرسال GIF من Giphy.',
    en: 'Search and send a GIF from Giphy.'
  },

  usage: {
    ar: '.gif <كلمة>',
    en: '.gif <query>'
  },
emoji: '🎞️',

  admin: false,
  owner: false,
  showInMenu: true,

  // runners
  run: gifExec,
  exec: gifExec,
  execute: gifExec,

  // توافق قديم
  gifCommand
};