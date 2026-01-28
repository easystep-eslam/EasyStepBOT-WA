const { getLang } = require('../../lib/lang');
const getApi = require('../../lib/api');

const api = getApi();
const processedMessages = new Set();

function pickChatId(chatIdArg, message) {
  if (typeof chatIdArg === 'string' && chatIdArg.includes('@')) return chatIdArg;
  const fromMsg = message?.key?.remoteJid || message?.chat;
  return typeof fromMsg === 'string' ? fromMsg : null;
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

function extractUrl(text) {
  const m = String(text || '').match(/https?:\/\/\S+/i);
  return m ? m[0].trim() : '';
}

function isValidInstagramUrl(url = '') {
  return [/https?:\/\/(?:www\.)?instagram\.com\//i, /https?:\/\/(?:www\.)?instagr\.am\//i].some((p) => p.test(url));
}

function extractUniqueMedia(mediaData) {
  const unique = [];
  const seen = new Set();
  for (const m of mediaData || []) {
    if (!m?.url) continue;
    if (seen.has(m.url)) continue;
    seen.add(m.url);
    unique.push(m);
  }
  return unique;
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function cleanupProcessedMessages() {
  if (processedMessages.size > 5000) processedMessages.clear();
}

function normalizeMediaItems(payload) {
  const out = [];

  const pushUrl = (u, t) => {
    const url = typeof u === 'string' ? u.trim() : '';
    if (!url || !/^https?:\/\//i.test(url)) return;
    const type =
      t ||
      (/\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url) ? 'video' : 'image');
    out.push({ url, type });
  };

  if (!payload) return out;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (typeof item === 'string') pushUrl(item);
      else if (item && typeof item === 'object') {
        pushUrl(item.url || item.link || item.download || item.src, item.type);
        if (Array.isArray(item.urls)) item.urls.forEach((x) => pushUrl(x, item.type));
      }
    }
    return out;
  }

  if (typeof payload === 'string') {
    pushUrl(payload);
    return out;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.media)) payload.media.forEach((x) => pushUrl(x?.url || x?.link || x, x?.type));
    if (Array.isArray(payload.medias)) payload.medias.forEach((x) => pushUrl(x?.url || x?.link || x, x?.type));
    pushUrl(payload.url || payload.link || payload.download || payload.video || payload.image, payload.type);

    if (Array.isArray(payload.result)) payload.result.forEach((x) => pushUrl(x?.url || x?.link || x, x?.type));
    if (Array.isArray(payload.data)) payload.data.forEach((x) => pushUrl(x?.url || x?.link || x, x?.type));
  }

  return out;
}

async function instagramCommand(sock, chatIdArg, message, args) {
  const chatId = pickChatId(chatIdArg, message);
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      needLink: 'Please provide an Instagram link.\nExample: .ig https://www.instagram.com/reel/xxxxx',
      invalidLink: 'That is not a valid Instagram link. Please send a valid post/reel/video link.',
      noMedia: '❌ No media found. The post might be private or the link is invalid.',
      failed: '❌ An error occurred while processing Instagram. Please try again.',
      caption: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧'
    },
    ar: {
      needLink: 'ابعت لينك انستجرام.\nمثال: .ig https://www.instagram.com/reel/xxxxx',
      invalidLink: 'ده مش لينك انستجرام صحيح. ابعت لينك بوست/ريل/فيديو صحيح.',
      noMedia: '❌ مفيش ميديا اتلقّت. ممكن البوست برايفت أو اللينك غلط.',
      failed: '❌ حصل خطأ أثناء تحميل الانستجرام. جرّب تاني.',
      caption: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    cleanupProcessedMessages();

    const msgId = message?.key?.id;
    if (msgId) {
      if (processedMessages.has(msgId)) return;
      processedMessages.add(msgId);
      setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);
    }

    const rawText = getText(message);
    const argsText = Array.isArray(args) && args.length ? args.join(' ') : '';
    const url = extractUrl(argsText) || extractUrl(rawText);

    if (!url) {
      await sock.sendMessage(chatId, { text: T.needLink }, { quoted: message });
      return;
    }

    if (!isValidInstagramUrl(url)) {
      await sock.sendMessage(chatId, { text: T.invalidLink }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, '🔄');

    const { data } = await api.get('/api/instagram', { params: { url } });

    const payload =
      data?.result ||
      data?.results ||
      data?.data ||
      data;

    const mediaData = normalizeMediaItems(payload);

    if (!Array.isArray(mediaData) || mediaData.length === 0) {
      await sock.sendMessage(chatId, { text: T.noMedia }, { quoted: message });
      return;
    }

    const uniqueMedia = extractUniqueMedia(mediaData).slice(0, 20);
    if (!uniqueMedia.length) {
      await sock.sendMessage(chatId, { text: T.noMedia }, { quoted: message });
      return;
    }

    for (let i = 0; i < uniqueMedia.length; i++) {
      const m = uniqueMedia[i];
      const mediaUrl = m.url;

      const isVideo =
        m.type === 'video' ||
        /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) ||
        /\/reel\/|\/tv\//i.test(url);

      try {
        if (isVideo) {
          await sock.sendMessage(
            chatId,
            { video: { url: mediaUrl }, mimetype: 'video/mp4', caption: T.caption },
            { quoted: message }
          );
        } else {
          await sock.sendMessage(chatId, { image: { url: mediaUrl }, caption: T.caption }, { quoted: message });
        }
      } catch (e) {
        console.error('[IG] send media error:', e?.message || e);
      }

      if (i < uniqueMedia.length - 1) {
        await new Promise((r) => setTimeout(r, 900));
      }
    }

    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[IG] error:', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'ig',
  aliases: ['ig', 'instagram', 'انستا'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل صور/فيديوهات من رابط انستجرام (بوست/ريل).',
    en: 'Download Instagram media from a link (post/reel).'
  },
  usage: {
    ar: '.ig <link>',
    en: '.ig <link>'
  },
  emoji: '📷',
  admin: true,
  owner: false,
  showInMenu: true,
  run: instagramCommand,
  exec: (sock, message, args) => instagramCommand(sock, message?.key?.remoteJid, message, args),
  execute: (sock, message, args) => instagramCommand(sock, message?.key?.remoteJid, message, args),
  instagramCommand
};