const axios = require('axios');
const yts = require('yt-search');
const { getLang } = require('../../lib/lang');

const AXIOS_DEFAULTS = {
  timeout: 60000,
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json, text/plain, */*'
  }
};

async function tryRequest(getter, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getter();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function getText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  ).trim();
}

function pickChatId(chatIdArg, message) {
  if (typeof chatIdArg === 'string' && chatIdArg.includes('@')) return chatIdArg;
  const fromMsg = message?.key?.remoteJid || message?.chat;
  return typeof fromMsg === 'string' ? fromMsg : null;
}

function isYouTubeUrl(url = '') {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url);
}

function safeTitle(name) {
  return String(name || 'YouTube Video')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

async function getYupraVideoByUrl(youtubeUrl) {
  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.success && res?.data?.data?.download_url) {
    return {
      download: res.data.data.download_url,
      title: res.data.data.title
    };
  }
  throw new Error('Yupra failed');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
  const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.result?.mp4) {
    return {
      download: res.data.result.mp4,
      title: res.data.result.title
    };
  }
  throw new Error('Okatsu failed');
}

async function videoCommand(sock, message, args = []) {
  const chatId = pickChatId(message?.key?.remoteJid, message);
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage: 'Usage: .video <youtube link | search text>\nExample: .video alan walker faded',
      notFound: '❌ No videos found!',
      invalid: '❌ This is not a valid YouTube link!',
      downloading: '⏳ Downloading...',
      downloaded: 'DOWNLOADED BY EASYSTEP-BOT',
      failed: '❌ Download failed. Try again later.'
    },
    ar: {
      usage: 'الاستخدام: .video <رابط يوتيوب | اسم الفيديو>\nمثال: .video alan walker faded',
      notFound: '❌ ملقيتش فيديوهات!',
      invalid: '❌ الرابط ده مش يوتيوب صحيح!',
      downloading: '⏳ جاري التحميل...',
      downloaded: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧',
      failed: '❌ فشل التحميل، حاول تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await safeReact(sock, chatId, message.key, '🎬');

    let query = (Array.isArray(args) && args.length ? args.join(' ') : '').trim();

    if (!query) {
      const text = getText(message);
      const used = (text.split(/\s+/)[0] || '.video').trim();
      query = text.slice(used.length).trim();
    }

    if (!query) {
      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
      return;
    }

    let videoUrl = '';
    let videoTitle = '';

    if (/^https?:\/\//i.test(query)) {
      if (!isYouTubeUrl(query)) {
        await sock.sendMessage(chatId, { text: T.invalid }, { quoted: message });
        return;
      }
      videoUrl = query;
    } else {
      const search = await yts(query);
      const first = search?.videos?.[0];
      if (!first?.url) {
        await sock.sendMessage(chatId, { text: T.notFound }, { quoted: message });
        return;
      }
      videoUrl = first.url;
      videoTitle = first.title || '';
    }

    await sock.sendMessage(chatId, { text: T.downloading }, { quoted: message });

    let videoData;
    try {
      videoData = await getYupraVideoByUrl(videoUrl);
    } catch {
      videoData = await getOkatsuVideoByUrl(videoUrl);
    }

    const title = safeTitle(videoData?.title || videoTitle || 'YouTube Video');

    await sock.sendMessage(
      chatId,
      {
        video: { url: videoData.download },
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`,
        caption: `*${title}*\n\n> ${T.downloaded}`
      },
      { quoted: message }
    );

    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[VIDEO]', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'video',
  aliases: ['video', 'ytvideo', 'ytmp4', 'فيديو', 'تحميل_فيديو', 'يوتيوب_فيديو'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل فيديو من يوتيوب (بحث أو رابط).',
    en: 'Download YouTube video (search or link).'
  },
  usage: {
    ar: '.video <رابط يوتيوب | اسم الفيديو>',
    en: '.video <youtube link | search text>'
  },
  emoji: '📹',
  admin: true,
  owner: false,
  showInMenu: true,
  run: videoCommand,
  exec: videoCommand,
  execute: videoCommand,
  videoCommand
};