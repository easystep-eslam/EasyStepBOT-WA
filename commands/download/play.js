const axios = require('axios');

const yts = require('yt-search');

const { toAudio } = require('../../lib/converter');

const { getLang } = require('../../lib/lang');

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

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

async function tryRequest(getter, attempts = 3) {

  let lastErr;

  for (let i = 0; i < attempts; i++) {

    try {

      return await getter();

    } catch (e) {

      lastErr = e;

      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 900 * (i + 1)));

    }

  }

  throw lastErr;

}

async function getYupra(url) {

  const api = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`;

  const res = await tryRequest(() => axios.get(api, AXIOS_DEFAULTS));

  if (res?.data?.success && res?.data?.data?.download_url) {

    return { download: res.data.data.download_url, title: res.data.data.title };

  }

  throw new Error('Yupra failed');

}

async function getOkatsu(url) {

  const api = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`;

  const res = await tryRequest(() => axios.get(api, AXIOS_DEFAULTS));

  if (res?.data?.dl) {

    return { download: res.data.dl, title: res.data.title };

  }

  throw new Error('Okatsu failed');

}

async function downloadToBuffer(url) {

  try {

    const r = await axios.get(url, {

      responseType: 'arraybuffer',

      timeout: 90000,

      headers: { 'Accept-Encoding': 'identity' }

    });

    return Buffer.from(r.data);

  } catch {

    const r = await axios.get(url, {

      responseType: 'stream',

      timeout: 90000,

      headers: { 'Accept-Encoding': 'identity' }

    });

    const chunks = [];

    await new Promise((res, rej) => {

      r.data.on('data', (c) => chunks.push(c));

      r.data.on('end', res);

      r.data.on('error', rej);

    });

    return Buffer.concat(chunks);

  }

}

function safeName(name) {

  return String(name || 'audio')

    .replace(/[\\/:*?"<>|]/g, '')

    .trim()

    .slice(0, 80);

}

function getRawText(message) {

  return (

    message.message?.conversation ||

    message.message?.extendedTextMessage?.text ||

    message.message?.imageMessage?.caption ||

    message.message?.videoMessage?.caption ||

    ''

  ).trim();

}

function extractQuery(message, args = []) {

  const rawText = getRawText(message);

  let query = (Array.isArray(args) && args.length ? args.join(' ') : '').trim();

  if (query) return query;

  const used = (rawText.split(/\s+/)[0] || 'play').trim();

  query = rawText.slice(used.length).trim();

  return query;

}

async function playCommand(sock, message, args = []) {

  const chatId = message.key.remoteJid;

  const lang = getLang(chatId);

  const TXT = {

    ar: {

      ask: '🎵 اكتب اسم الأغنية.\nمثال: .play adhan',

      searching: (q) => `🔎 بدوّر على: *${q}* ...`,

      picked: (t) => `✅ لقيت:\n*${t}*`,

      // تم إلغاء رسائل التقدم التالية:

      // fetching: '📥 بجهّز رابط التحميل...',

      // converting: '🎧 بتحويل الصوت...',

      // sending: '📨 جاري الإرسال...',

      notFound: '❌ ملقتش نتيجة بالاسم ده.',

      fail: '❌ فشل التحميل. جرّب تاني.'

    },

    en: {

      ask: '🎵 Enter song name.\nExample: .play believer',

      searching: (q) => `🔎 Searching for: *${q}* ...`,

      picked: (t) => `✅ Found:\n*${t}*`,

      // Progress messages removed:

      // fetching: '📥 Getting download link...',

      // converting: '🎧 Converting audio...',

      // sending: '📨 Sending...',

      notFound: '❌ No results found.',

      fail: '❌ Download failed. Try again.'

    }

  };

  const T = TXT[lang] || TXT.en;

  try {

    await safeReact(sock, chatId, message.key, '🎶');

    const query = extractQuery(message, args);

    if (!query) {

      await sock.sendMessage(chatId, { text: T.ask }, { quoted: message });

      return;

    }

    await sock.sendMessage(chatId, { text: T.searching(query) }, { quoted: message });

    const search = await yts(query);

    const video = search?.videos?.[0];

    if (!video) {

      await safeReact(sock, chatId, message.key, '❌');

      await sock.sendMessage(chatId, { text: T.notFound }, { quoted: message });

      return;

    }

    await sock.sendMessage(chatId, { text: T.picked(video.title) }, { quoted: message });

    const headerCaption =

      lang === 'ar'

        ? `🎵 جاري التحميل\n━━━━━━━━━━━━━━━\n📖 ${video.title}\n⏱ ${video.timestamp}\n━━━━━━━━━━━━━━━\ndownload by ©𝑬𝑨𝑺𝒀𝑺𝑻𝑬𝑷-𝑩𝑶𝑻`

        : `🎵 Downloading\n━━━━━━━━━━━━━━━\n📖 ${video.title}\n⏱ ${video.timestamp}\n━━━━━━━━━━━━━━━\ndownload by ©EASYSTEP-BOT`;

    await sock.sendMessage(

      chatId,

      { image: { url: video.thumbnail }, caption: headerCaption },

      { quoted: message }

    );

    // ✅ تم إلغاء رسالة: T.fetching

    let audioInfo;

    try {

      audioInfo = await getYupra(video.url);

    } catch {

      audioInfo = await getOkatsu(video.url);

    }

    const rawBuffer = await downloadToBuffer(audioInfo.download);

    if (!rawBuffer || !rawBuffer.length) throw new Error('Empty buffer');

    // ✅ تم إلغاء رسالة: T.converting

    const finalBuffer = await toAudio(rawBuffer, 'mp3');

    const fileName = `${safeName(audioInfo.title || video.title)}.mp3`;

    // ✅ تم إلغاء رسالة: T.sending

    await sock.sendMessage(

      chatId,

      { audio: finalBuffer, mimetype: 'audio/mpeg', fileName },

      { quoted: message }

    );

    await safeReact(sock, chatId, message.key, '✅');

  } catch (err) {

    console.error('[PLAY]', err?.stack || err);

    await safeReact(sock, chatId, message.key, '❌');

    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });

  }

}

module.exports = {

  name: 'play',

  aliases: ['play', 'شغل', 'music'],

  category: {

    ar: '📥 أوامر التحميل',

    en: '📥 Download Commands'

  },

  description: {

    ar: 'يبحث في يوتيوب ويحمّل أول نتيجة كملف MP3.',

    en: 'Search YouTube and download the first result as an MP3 file.'

  },

  usage: {

    ar: '.play <اسم الأغنية>',

    en: '.play <song name>'

  },
emoji: '🎵',
  admin: false,

  owner: false,

  showInMenu: true,

  run: playCommand,

  exec: playCommand,

  execute: playCommand

};