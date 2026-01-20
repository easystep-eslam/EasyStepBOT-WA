const axios = require('axios');

const yts = require('yt-search');

const fs = require('fs');

const path = require('path');

const { toAudio } = require('../../lib/converter');

const { getLang } = require('../../lib/lang');

const AXIOS_DEFAULTS = {

  timeout: 60000,

  headers: {

    'User-Agent':

      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    Accept: 'application/json, text/plain, */*'

  }

};

async function safeReact(sock, chatId, key, emoji) {

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

async function tryRequest(getter, attempts = 3) {

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {

    try {

      return await getter();

    } catch (err) {

      lastError = err;

      if (attempt < attempts) await new Promise((r) => setTimeout(r, 900 * attempt));

    }

  }

  throw lastError;

}

async function getYupraDownloadByUrl(youtubeUrl) {

  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;

  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));

  if (res?.data?.success && res?.data?.data?.download_url) {

    return {

      download: res.data.data.download_url,

      title: res.data.data.title,

      thumbnail: res.data.data.thumbnail

    };

  }

  throw new Error('Yupra returned no download');

}

async function getOkatsuDownloadByUrl(youtubeUrl) {

  const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;

  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));

  if (res?.data?.dl) {

    return {

      download: res.data.dl,

      title: res.data.title,

      thumbnail: res.data.thumb

    };

  }

  throw new Error('Okatsu ytmp3 returned no download');

}

function safeFileName(name) {

  return String(name || 'song')

    .replace(/[\\/:*?"<>|]/g, '')

    .replace(/\s+/g, ' ')

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

  let query = (Array.isArray(args) && args.length) ? args.join(' ').trim() : '';

  if (query) return query;

  const rawText = getRawText(message);

  const used = (rawText.split(/\s+/)[0] || '.song').trim();

  query = rawText.slice(used.length).trim();

  return query;

}

function isYouTubeUrl(text) {

  const s = String(text || '');

  if (!/https?:\/\/\S+/i.test(s)) return false;

  return s.includes('youtube.com') || s.includes('youtu.be');

}

async function cleanupTempAudioFiles() {

  try {

    const tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(tempDir)) return;

    const files = fs.readdirSync(tempDir);

    const now = Date.now();

    for (const file of files) {

      const filePath = path.join(tempDir, file);

      try {

        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs <= 10000) continue;

        const isAudio =

          file.endsWith('.mp3') ||

          file.endsWith('.m4a') ||

          file.endsWith('.ogg') ||

          file.endsWith('.wav') ||

          /^\d+\.(mp3|m4a|ogg|wav)$/i.test(file);

        if (isAudio) fs.unlinkSync(filePath);

      } catch {}

    }

  } catch {}

}

async function downloadToBuffer(url) {

  try {

    const audioResponse = await axios.get(url, {

      responseType: 'arraybuffer',

      timeout: 90000,

      maxContentLength: Infinity,

      maxBodyLength: Infinity,

      decompress: true,

      validateStatus: (s) => s >= 200 && s < 400,

      headers: {

        'User-Agent':

          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

        Accept: '*/*',

        'Accept-Encoding': 'identity'

      }

    });

    return Buffer.from(audioResponse.data);

  } catch {

    const audioResponse = await axios.get(url, {

      responseType: 'stream',

      timeout: 90000,

      maxContentLength: Infinity,

      maxBodyLength: Infinity,

      validateStatus: (s) => s >= 200 && s < 400,

      headers: {

        'User-Agent':

          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

        Accept: '*/*',

        'Accept-Encoding': 'identity'

      }

    });

    const chunks = [];

    await new Promise((resolve, reject) => {

      audioResponse.data.on('data', (c) => chunks.push(c));

      audioResponse.data.on('end', resolve);

      audioResponse.data.on('error', reject);

    });

    return Buffer.concat(chunks);

  }

}

function detectAudioExt(buffer) {

  if (!buffer || buffer.length < 12) return 'm4a';

  const head12 = buffer.slice(0, 12);

  const hex = head12.toString('hex');

  const ascii0_3 = buffer.toString('ascii', 0, 3);

  const ascii0_4 = buffer.toString('ascii', 0, 4);

  const ascii4_8 = buffer.toString('ascii', 4, 8);

  if (ascii4_8 === 'ftyp' || hex.startsWith('000000')) return 'm4a';

  if (ascii0_3 === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'mp3';

  if (ascii0_4 === 'OggS') return 'ogg';

  if (ascii0_4 === 'RIFF') return 'wav';

  return 'm4a';

}

async function songCommand(sock, message, args = []) {

  const chatId = message.key.remoteJid;

  const lang = getLang(chatId);

  const TXT = {

    en: {

      usage: 'Usage: .song <song name or YouTube link>\nExample: .song believer',

      searching: (q) => `🔎 Searching: *${q}* ...`,

      noResults: '❌ No results found.',

      downloading: (t, d) => `🎵 Downloading: *${t}*\n⏱ Duration: ${d || 'Unknown'}`,

      gettingLink: '📥 Getting download link...',

      fetchingAudio: '⬇️ Downloading audio...',

      converting: '🎧 Converting to MP3...',

      sending: '📨 Sending...',

      failed: '❌ Failed to download song.'

    },

    ar: {

      usage: 'الاستخدام: .song <اسم الأغنية أو رابط يوتيوب>\nمثال: .song believer',

      searching: (q) => `🔎 بدوّر على: *${q}* ...`,

      noResults: '❌ ملقيتش نتائج.',

      downloading: (t, d) => `🎵 جاري التحميل: *${t}*\n⏱ المدة: ${d || 'غير معروف'}`,

      gettingLink: '📥 بجيب رابط التحميل...',

      fetchingAudio: '⬇️ جاري تحميل الصوت...',

      converting: '🎧 جاري التحويل لـ MP3...',

      sending: '📨 جاري الإرسال...',

      failed: '❌ فشل تحميل الأغنية.'

    }

  };

  const T = TXT[lang] || TXT.en;

  try {

    await safeReact(sock, chatId, message.key, '🎵');

    const query = extractQuery(message, args);

    if (!query) {

      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });

      return;

    }

    let video;

    if (isYouTubeUrl(query)) {

      video = { url: query };

    } else {

      await sock.sendMessage(chatId, { text: T.searching(query) }, { quoted: message });

      const search = await yts(query);

      if (!search?.videos?.length) {

        await safeReact(sock, chatId, message.key, '❌');

        await sock.sendMessage(chatId, { text: T.noResults }, { quoted: message });

        return;

      }

      video = search.videos[0];

    }

    const thumb = video.thumbnail || null;

    const caption = T.downloading(video.title || 'YouTube', video.timestamp);

    if (thumb) {

      await sock.sendMessage(chatId, { image: { url: thumb }, caption }, { quoted: message });

    } else {

      await sock.sendMessage(chatId, { text: caption }, { quoted: message });

    }

    // ❌ Removed (both languages): T.gettingLink

    // await sock.sendMessage(chatId, { text: T.gettingLink }, { quoted: message });

    let audioData;

    try {

      audioData = await getYupraDownloadByUrl(video.url);

    } catch {

      audioData = await getOkatsuDownloadByUrl(video.url);

    }

    const audioUrl = audioData?.download || audioData?.dl || audioData?.url;

    if (!audioUrl) throw new Error('Missing download url');

    await sock.sendMessage(chatId, { text: T.fetchingAudio }, { quoted: message });

    const audioBuffer = await downloadToBuffer(audioUrl);

    if (!audioBuffer || audioBuffer.length === 0) throw new Error('Downloaded audio buffer is empty');

    const ext = detectAudioExt(audioBuffer);

    let finalBuffer = audioBuffer;

    if (ext !== 'mp3') {

      // ❌ Removed (both languages): T.converting

      // await sock.sendMessage(chatId, { text: T.converting }, { quoted: message });

      finalBuffer = await toAudio(audioBuffer, ext);

      if (!finalBuffer || finalBuffer.length === 0) throw new Error('Conversion returned empty buffer');

    }

    const fileName = `${safeFileName(audioData.title || video.title || 'song')}.mp3`;

    // ❌ Removed (both languages): T.sending

    // await sock.sendMessage(chatId, { text: T.sending }, { quoted: message });

    await sock.sendMessage(

      chatId,

      {

        audio: finalBuffer,

        mimetype: 'audio/mpeg',

        fileName,

        ptt: false

      },

      { quoted: message }

    );

    await cleanupTempAudioFiles();

    await safeReact(sock, chatId, message.key, '✅');

  } catch (err) {

    console.error('[SONG]', err?.stack || err);

    await safeReact(sock, chatId, message.key, '❌');

    await sock.sendMessage(

      chatId,

      { text: (getLang(chatId) === 'ar' ? '❌ فشل تحميل الأغنية.' : '❌ Failed to download song.') },

      { quoted: message }

    );

  }

}

module.exports = {

  name: 'song',

  aliases: ['song', 'play', 'music', 'اغنية', 'أغنية', 'شغل'],

  category: {

    ar: '📥 أوامر التحميل',

    en: '📥 Download Commands'

  },

  description: {

    ar: 'تحميل أغنية MP3 من يوتيوب بالاسم أو بالرابط.',

    en: 'Download an MP3 from YouTube by name or by link.'

  },

  usage: {

    ar: '.song <اسم الأغنية أو رابط يوتيوب>',

    en: '.song <song name or YouTube link>'

  },
emoji: '🎶',
  admin: true,

  owner: false,

  showInMenu: true,

  run: songCommand,

  exec: songCommand,

  execute: songCommand

};