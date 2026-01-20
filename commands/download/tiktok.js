const { ttdl } = require('ruhend-scraper');
const axios = require('axios');
const { getLang } = require('../../lib/lang');

const processedMessages = new Set();

function getRawText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  ).trim();
}

function extractUrlFromText(text = '') {
  const m = String(text || '').match(/https?:\/\/\S+/i);
  return m ? m[0].trim() : '';
}

function isValidTikTokUrl(url = '') {
  const patterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\//i,
    /https?:\/\/(?:vm\.)?tiktok\.com\//i,
    /https?:\/\/(?:vt\.)?tiktok\.com\//i
  ];
  return patterns.some((p) => p.test(url));
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function T(chatId) {
  const lang = getLang(chatId);
  const TXT = {
    en: {
      usage:
        '🎵 TikTok Downloader\n\n' +
        'Usage:\n' +
        '.tiktok <link>\n.tik <link>\n.tt <link>\n\n' +
        'Example:\n' +
        '.tt https://www.tiktok.com/@user/video/123',
      invalidLink: 'That is not a valid TikTok link.',
      wait: '⏳ Please wait… downloading now.',
      failAll:
        '❌ Failed to download TikTok video.\n' +
        'Try another link or check if the video is available.',
      caption: (title) =>
        `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧\n\n📝 Title: ${title || 'TikTok Video'}`
    },
    ar: {
      usage:
        '🎵 تحميل تيك توك\n\n' +
        'الاستخدام:\n' +
        '.tiktok <لينك>\n.tik <لينك>\n.tt <لينك>\n\n' +
        'مثال:\n' +
        '.tt https://www.tiktok.com/@user/video/123',
      invalidLink: 'ده مش لينك تيك توك صحيح.',
      wait: '⏳ استنى شوية… جاري التحميل.',
      failAll:
        '❌ فشل تحميل فيديو التيك توك.\n' +
        'جرّب لينك تاني أو اتأكد إن الفيديو متاح.',
      caption: (title) =>
        `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧\n\n📝 العنوان: ${title || 'فيديو تيك توك'}`
    }
  };
  return { lang, TXT: TXT[lang] || TXT.en };
}

function extractUrl(message, args = []) {
  let url = (Array.isArray(args) && args.length ? args.join(' ') : '').trim();
  if (url) return url;

  const raw = getRawText(message);
  url = extractUrlFromText(raw);
  return url;
}

async function resolveFromSiputzx(url) {
  const apiUrl = `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`;

  const res = await axios.get(apiUrl, {
    timeout: 20000,
    headers: {
      accept: '*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    validateStatus: (s) => s >= 200 && s < 500
  });

  const d = res?.data?.data;
  if (!res?.data?.status || !d) return null;

  const title = d?.metadata?.title || d?.title || 'TikTok Video';

  let videoUrl =
    (Array.isArray(d.urls) && d.urls[0]) ||
    d.video_url ||
    d.url ||
    d.download_url ||
    null;

  let audioUrl = d.audio_url || d.music_url || null;

  if (typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) videoUrl = null;
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) audioUrl = null;

  if (!videoUrl && !audioUrl) return null;
  return { title, videoUrl, audioUrl };
}

function pickBestFromTtdl(mediaData = []) {
  const items = Array.isArray(mediaData) ? mediaData : [];
  let videoUrl = null;
  let audioUrl = null;

  const videos = items.filter((x) => x?.type === 'video' && typeof x.url === 'string');
  const audios = items.filter((x) => x?.type === 'audio' && typeof x.url === 'string');

  if (videos.length) {
    const hd =
      videos.find((v) => /hd|high/i.test(String(v.quality || v.resolution || ''))) ||
      videos[0];
    videoUrl = hd.url;
  }

  if (audios.length) {
    const best =
      audios.find((a) => /mp3|m4a|aac/i.test(String(a.format || a.ext || ''))) ||
      audios[0];
    audioUrl = best.url;
  }

  if (typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) videoUrl = null;
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) audioUrl = null;

  return { videoUrl, audioUrl };
}

async function tiktokCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const { lang, TXT } = T(chatId);

  try {
    const msgId = message?.key?.id;
    if (msgId) {
      if (processedMessages.has(msgId)) return;
      processedMessages.add(msgId);
      setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);
    }

    const url = extractUrl(message, args);

    if (!url) {
      await sock.sendMessage(chatId, { text: TXT.usage }, { quoted: message });
      return;
    }

    if (!isValidTikTokUrl(url)) {
      await sock.sendMessage(chatId, { text: TXT.invalidLink }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, '🎵');
    await sock.sendMessage(chatId, { text: TXT.wait }, { quoted: message });

    let title = null;
    let videoUrl = null;
    let audioUrl = null;

    const sip = await (async () => {
      try {
        return await resolveFromSiputzx(url);
      } catch {
        return null;
      }
    })();

    if (sip) {
      title = sip.title;
      videoUrl = sip.videoUrl || null;
      audioUrl = sip.audioUrl || null;
    }

    if (!videoUrl) {
      try {
        const downloadData = await ttdl(url).catch(() => null);
        const mediaData = downloadData?.data || [];
        const picked = pickBestFromTtdl(mediaData);
        videoUrl = videoUrl || picked.videoUrl;
        audioUrl = audioUrl || picked.audioUrl;

        if (!title) {
          title =
            downloadData?.title ||
            downloadData?.result?.title ||
            downloadData?.data?.[0]?.title ||
            'TikTok Video';
        }
      } catch {}
    }

    if (!videoUrl) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: TXT.failAll }, { quoted: message });
      return;
    }

    const caption = TXT.caption(title);

    try {
      await sock.sendMessage(
        chatId,
        { video: { url: videoUrl }, mimetype: 'video/mp4', caption },
        { quoted: message }
      );
    } catch {
      const buf = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 90000 });
      await sock.sendMessage(
        chatId,
        { video: Buffer.from(buf.data), mimetype: 'video/mp4', caption },
        { quoted: message }
      );
    }

    if (audioUrl) {
      try {
        const audioName =
          lang === 'ar'
            ? 'tiktok_audio.mp3'
            : 'tiktok_audio.mp3';

        await sock.sendMessage(
          chatId,
          { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: audioName, ptt: false },
          { quoted: message }
        );
      } catch {}
    }

    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[TIKTOK] error:', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    const { TXT } = T(chatId);
    await sock.sendMessage(chatId, { text: TXT.failAll }, { quoted: message });
  }
}

module.exports = {
  name: 'tiktok',
  aliases: ['tiktok', 'tik', 'tt', 'تيك', 'تيكتوك'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل فيديو تيك توك من الرابط.',
    en: 'Download TikTok videos from a link.'
  },
  usage: {
    ar: '.tt <لينك تيك توك>',
    en: '.tt <tiktok link>'
  },
  emoji: '🎬',
  admin: true,
  owner: false,
  showInMenu: true,
  run: tiktokCommand,
  exec: tiktokCommand,
  execute: tiktokCommand,
  tiktokCommand
};