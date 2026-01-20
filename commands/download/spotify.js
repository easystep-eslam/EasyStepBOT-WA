const axios = require('axios');
const { getLang } = require('../../lib/lang');

function safeFileName(name) {
  return String(name || 'track')
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

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function extractQuery(message, args = []) {
  let q = (Array.isArray(args) && args.length) ? args.join(' ').trim() : '';
  if (q) return q;

  const raw = getRawText(message);
  const used = (raw.split(/\s+/)[0] || '.spotify').trim();
  q = raw.slice(used.length).trim();
  return q;
}

async function spotifyCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage:
        '🎧 Spotify Downloader\n\n' +
        'Usage:\n' +
        '.spotify <song / artist / keywords>\n\n' +
        'Examples:\n' +
        '.spotify con calma\n' +
        '.spotify eminem lose yourself\n' +
        '.spotify ya habibi\n',
      searching: (q) => `🔎 Searching Spotify for: *${q}* ...`,
      found: (title, artist) => `✅ Found:\n🎵 ${title}\n👤 ${artist}`,
      noAudio: '❌ No downloadable audio found for this track.',
      failed: '❌ Failed to fetch Spotify audio. Try again later.',
      caption: (r) =>
        `🎵 ${r.title || r.name || 'Unknown Title'}\n` +
        `👤 ${r.artist || 'Unknown Artist'}\n` +
        `⏱ ${r.duration || 'Unknown'}\n` +
        `🔗 ${r.url || ''}`
    },
    ar: {
      usage:
        '🎧 تحميل من سبوتيفاي\n\n' +
        'الاستخدام:\n' +
        '.spotify <اسم الأغنية / المطرب / كلمات>\n\n' +
        'أمثلة:\n' +
        '.spotify con calma\n' +
        '.spotify عمرو دياب\n' +
        '.spotify ya habibi\n',
      searching: (q) => `🔎 بدوّر في سبوتيفاي على: *${q}* ...`,
      found: (title, artist) => `✅ لقيت:\n🎵 ${title}\n👤 ${artist}`,
      noAudio: '❌ مفيش ملف صوتي متاح للأغنية دي.',
      failed: '❌ فشل تحميل الأغنية من سبوتيفاي، جرّب تاني بعد شوية.',
      caption: (r) =>
        `🎵 ${r.title || r.name || 'اسم غير معروف'}\n` +
        `👤 ${r.artist || 'فنان غير معروف'}\n` +
        `⏱ ${r.duration || 'غير معروف'}\n` +
        `🔗 ${r.url || ''}`
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await safeReact(sock, chatId, message.key, '🎧');

    const query = extractQuery(message, args);
    if (!query) {
      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: T.searching(query) }, { quoted: message });

    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(apiUrl, {
      timeout: 25000,
      headers: { 'user-agent': 'Mozilla/5.0' }
    });

    if (!data?.status || !data?.result) {
      throw new Error('No result from Spotify API');
    }

    const r = data.result;
    const audioUrl = r.audio;

    if (!audioUrl) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.noAudio }, { quoted: message });
      return;
    }

    const title = r.title || r.name || (lang === 'ar' ? 'اسم غير معروف' : 'Unknown Title');
    const artist = r.artist || (lang === 'ar' ? 'فنان غير معروف' : 'Unknown Artist');

    await sock.sendMessage(chatId, { text: T.found(title, artist) }, { quoted: message });

    const caption = String((T.caption(r) || '')).trim();

    if (r.thumbnails) {
      await sock.sendMessage(
        chatId,
        { image: { url: r.thumbnails }, caption },
        { quoted: message }
      );
    } else if (caption) {
      await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    }

    const fileName = `${safeFileName(title)}.mp3`;

    await sock.sendMessage(
      chatId,
      { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName, ptt: false },
      { quoted: message }
    );

    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[SPOTIFY] error:', error?.message || error);
    await sock.sendMessage(chatId, { text: (T.failed || (lang === 'ar' ? '❌ حصل خطأ.' : '❌ Error.')) }, { quoted: message });
    await safeReact(sock, chatId, message.key, '❌');
  }
}

module.exports = {
  name: 'spotify',
  aliases: ['spotify', 'sp', 'سبوتيفاي'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل أغاني من سبوتيفاي بالبحث بالكلمات.',
    en: 'Download Spotify tracks by searching keywords.'
  },
  usage: {
    ar: '.spotify <اسم الأغنية / المطرب / كلمات>',
    en: '.spotify <song / artist / keywords>'
  },
  emoji: '🎧',
  admin: true,
  owner: false,
  showInMenu: true,
  run: spotifyCommand,
  exec: spotifyCommand,
  execute: spotifyCommand
};