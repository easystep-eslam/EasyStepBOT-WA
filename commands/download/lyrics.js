const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

function chunkText(text, maxLen = 3500) {
  const s = String(text || '').replace(/\r/g, '').trim();
  if (!s) return [];
  if (s.length <= maxLen) return [s];

  const chunks = [];
  const lines = s.split('\n');
  let cur = '';

  for (const line of lines) {
    const piece = (cur ? cur + '\n' : '') + line;
    if (piece.length <= maxLen) {
      cur = piece;
      continue;
    }

    if (cur) chunks.push(cur.trim());
    cur = '';

    if (line.length <= maxLen) {
      cur = line;
    } else {
      let start = 0;
      while (start < line.length) {
        chunks.push(line.slice(start, start + maxLen).trim());
        start += maxLen;
      }
    }
  }

  if (cur) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function lyricsCommand(sock, message, args) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const T = {
    en: {
      usage: '🔍 Usage: .lyrics <song name>',
      notFound: (q) => `❌ No lyrics found for "${q}".`,
      error: '❌ Failed to fetch lyrics.'
    },
    ar: {
      usage: '🔍 الاستخدام: .lyrics <اسم الأغنية>',
      notFound: (q) => `❌ ملقيناش كلمات للأغنية: "${q}".`,
      error: '❌ حصل خطأ أثناء جلب الكلمات.'
    }
  };

  const TXT = T[lang] || T.en;

  const query = (args || []).join(' ').trim();
  if (!query) {
    await sock.sendMessage(chatId, { text: TXT.usage }, { quoted: message });
    return;
  }

  await safeReact(sock, chatId, message.key, '🎵');

  try {
    const apiUrl = `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(query)}`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      await sock.sendMessage(chatId, { text: TXT.notFound(query) }, { quoted: message });
      await safeReact(sock, chatId, message.key, '❌');
      return;
    }

    const data = await res.json().catch(() => ({}));
    const lyrics = data?.result?.lyrics;

    if (!lyrics || typeof lyrics !== 'string') {
      await sock.sendMessage(chatId, { text: TXT.notFound(query) }, { quoted: message });
      await safeReact(sock, chatId, message.key, '❌');
      return;
    }

    const parts = chunkText(lyrics, 3500);

    if (lang === 'ar') {
      await sock.sendMessage(
        chatId,
        { text: `🎵 *كلمات الأغنية*\n🔎 ${query}\n\n${parts[0]}` },
        { quoted: message }
      );
    } else {
      await sock.sendMessage(
        chatId,
        { text: `🎵 *Lyrics*\n🔎 ${query}\n\n${parts[0]}` },
        { quoted: message }
      );
    }

    for (let i = 1; i < parts.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      await sock.sendMessage(chatId, { text: parts[i] }, { quoted: message });
    }

    await safeReact(sock, chatId, message.key, '✅');
  } catch (err) {
    console.error('[LYRICS]', err);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: TXT.error }, { quoted: message });
  }
}

module.exports = {
  name: 'lyrics',
  aliases: ['ly', 'كلمات', 'اغنية', 'أغنية'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'يجلب كلمات أغنية بالاسم ويرسلها على أجزاء لو طويلة.',
    en: 'Fetch song lyrics by name and send them in multiple messages if long.'
  },
  usage: {
    ar: '.lyrics <اسم الأغنية>',
    en: '.lyrics <song name>'
  },
  emoji: '📝',
  admin: false,
  owner: false,
  showInMenu: true,
  run: lyricsCommand,
  exec: lyricsCommand,
  execute: lyricsCommand
};