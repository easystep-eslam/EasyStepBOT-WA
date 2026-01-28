const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');
const getApi = require('../../lib/api');

const api = getApi();

function pickChatId(maybeChatId, message) {
  if (typeof maybeChatId === 'string' && maybeChatId.includes('@')) return maybeChatId;
  const fromMsg = message?.key?.remoteJid || message?.chat;
  return typeof fromMsg === 'string' ? fromMsg : null;
}

function getText(message) {
  return (
    message?.message?.conversation?.trim() ||
    message?.message?.extendedTextMessage?.text?.trim() ||
    message?.message?.imageMessage?.caption?.trim() ||
    message?.message?.videoMessage?.caption?.trim() ||
    ''
  );
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function getUsedCmd(rawText) {
  const first = (String(rawText || '').trim().split(/\s+/)[0] || '').toLowerCase();
  return first.startsWith('.') ? first.slice(1) : first;
}

async function facebookCommand(sock, chatIdArg, message) {
  const chatId = pickChatId(chatIdArg, message);
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      needUrl: 'Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/...',
      notFb: 'That is not a Facebook link.',
      cantGet:
        '❌ Failed to get video URL from Facebook.\n\nPossible reasons:\n• Video is private or deleted\n• Link is invalid\n• Video is not available for download\n\nPlease try a different Facebook video link.',
      apiDown: (e) => 'An error occurred. API might be down.\nError: ' + (e || 'Unknown'),
      downloadedBy: '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧',
      titleLabel: '📝 Title: '
    },
    ar: {
      needUrl: 'من فضلك ابعت رابط فيديو فيسبوك.\nمثال: .fb https://www.facebook.com/...',
      notFb: 'ده مش رابط فيسبوك.',
      cantGet:
        '❌ فشلنا نجيب رابط الفيديو من فيسبوك.\n\nأسباب محتملة:\n• الفيديو خاص أو اتحذف\n• الرابط غير صحيح\n• الفيديو غير متاح للتحميل\n\nجرّب رابط فيديو فيسبوك تاني.',
      apiDown: (e) => 'حصل خطأ. ممكن الـ API واقف.\nالخطأ: ' + (e || 'غير معروف'),
      downloadedBy: '𝗧𝗠 𝗧𝗔𝗛𝗠𝗜𝗟 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧',
      titleLabel: '📝 العنوان: '
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const rawText = getText(message);
    const usedCmd = getUsedCmd(rawText) || 'fb';
    const firstToken = (rawText.trim().split(/\s+/)[0] || '').trim();
    const url = rawText.slice(firstToken.length).trim();

    if (!url) {
      await sock.sendMessage(chatId, { text: T.needUrl }, { quoted: message });
      return;
    }

    if (!/facebook\.com|fb\.watch/i.test(url)) {
      await sock.sendMessage(chatId, { text: T.notFb }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, '📥');

    let resolvedUrl = url;
    try {
      const res = await axios.get(url, {
        timeout: 20000,
        maxRedirects: 10,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const possible = res?.request?.res?.responseUrl;
      if (typeof possible === 'string' && possible.startsWith('http')) resolvedUrl = possible;
    } catch {}

    async function fetchFromApi(u) {
      const { data } = await api.get('/api/facebook', { params: { url: u } });
      return data || null;
    }

    let data = null;
    try {
      data = await fetchFromApi(resolvedUrl);
    } catch {}
    if (!data) data = await fetchFromApi(url);

    let fbvid = null;
    let title = null;

    const r = data?.result || data?.results || data?.data || data;

    if (r?.media) {
      fbvid = r.media.video_hd || r.media.hd || r.media.video_sd || r.media.sd;
      title = r.info?.title || r.title || data?.title || 'Facebook Video';
    } else if (r && typeof r === 'object') {
      fbvid =
        r.video_hd ||
        r.hd ||
        r.video_sd ||
        r.sd ||
        r.url ||
        r.link ||
        r.download ||
        (typeof r.video === 'string' ? r.video : r.video?.url) ||
        null;

      title =
        r.title ||
        r.caption ||
        r.info?.title ||
        data?.title ||
        'Facebook Video';
    } else if (typeof r === 'string' && r.startsWith('http')) {
      fbvid = r;
      title = data?.title || 'Facebook Video';
    }

    if (!fbvid) {
      await sock.sendMessage(chatId, { text: T.cantGet }, { quoted: message });
      return;
    }

    const caption = title ? `${T.downloadedBy}\n\n${T.titleLabel}${title}` : T.downloadedBy;

    try {
      await sock.sendMessage(chatId, { video: { url: fbvid }, mimetype: 'video/mp4', caption }, { quoted: message });
      return;
    } catch {}

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

    try {
      const videoResponse = await axios({
        method: 'GET',
        url: fbvid,
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.8',
          Referer: 'https://www.facebook.com/'
        }
      });

      const writer = fs.createWriteStream(tempFile);
      videoResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) throw new Error('Empty temp video file');

      await sock.sendMessage(chatId, { video: { url: tempFile }, mimetype: 'video/mp4', caption }, { quoted: message });
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  } catch (error) {
    console.error('Error in Facebook command:', error);
    await sock.sendMessage(chatId, { text: T.apiDown(error?.message || error) }, { quoted: message });
  }
}

module.exports = {
  name: 'fb',
  aliases: ['fb', 'facebook', 'فيس', 'فيسبوك'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل فيديو من فيسبوك من خلال رابط (يدعم facebook.com و fb.watch).',
    en: 'Download a Facebook video from a link (supports facebook.com and fb.watch).'
  },
  usage: {
    ar: '.fb <link>',
    en: '.fb <link>'
  },
  emoji: '📥',
  admin: true,
  owner: false,
  showInMenu: true,
  run: facebookCommand,
  exec: (sock, message) => facebookCommand(sock, message?.key?.remoteJid, message),
  execute: (sock, message) => facebookCommand(sock, message?.key?.remoteJid, message),
  facebookCommand
};