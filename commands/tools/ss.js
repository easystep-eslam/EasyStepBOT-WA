const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
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

function extractUrl(message, args = []) {
  const fromArgs = Array.isArray(args) && args.length ? args.join(' ').trim() : '';
  if (fromArgs) return fromArgs;

  const raw = getRawText(message);
  const used = (raw.split(/\s+/)[0] || '.ss').trim();
  return raw.slice(used.length).trim();
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

async function ssCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      menu:
        `*SCREENSHOT TOOL*\n\n` +
        `• .ss <url>\n• .ssweb <url>\n• .screenshot <url>\n\n` +
        `Example:\n.ss https://google.com`,
      invalidUrl: '❌ Please provide a valid URL starting with http:// or https://',
      failed:
        '❌ Failed to take screenshot. Please try again later.\n\nPossible reasons:\n• Invalid URL\n• Website is blocking screenshots\n• Website is down\n• API service is temporarily unavailable'
    },
    ar: {
      menu:
        `*📸 أداة تصوير المواقع*\n\n` +
        `• .ss <رابط>\n• .ssweb <رابط>\n• .screenshot <رابط>\n\n` +
        `مثال:\n.ss https://google.com`,
      invalidUrl: '❌ لازم تبعت رابط صحيح يبدأ بـ http:// أو https://',
      failed:
        '❌ فشل تصوير الموقع، جرّب تاني بعد شوية.\n\nأسباب محتملة:\n• الرابط غلط\n• الموقع بيمنع التصوير\n• الموقع واقع\n• خدمة الـ API مش شغالة مؤقتًا'
    }
  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '📸');

  const url = extractUrl(message, args);
  if (!url) {
    return sock.sendMessage(chatId, { text: T.menu }, { quoted: message });
  }

  if (!isHttpUrl(url)) {
    return sock.sendMessage(chatId, { text: T.invalidUrl }, { quoted: message });
  }

  try {
    try {
      await sock.presenceSubscribe(chatId);
      await sock.sendPresenceUpdate('composing', chatId);
    } catch {}

    let imageBuffer = null;

    // API 1
    try {
      const api1 =
        `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}` +
        `&theme=light&device=desktop`;

      const r1 = await fetch(api1);
      const ct1 = String(r1.headers.get('content-type') || '').toLowerCase();
      if (r1.ok && ct1.includes('image')) {
        imageBuffer = await r1.buffer();
      }
    } catch {}

    // API 2 (fallback)
    if (!imageBuffer) {
      try {
        const api2 = `https://image.thum.io/get/width/1200/${url}`;
        const r2 = await fetch(api2);
        const ct2 = String(r2.headers.get('content-type') || '').toLowerCase();
        if (r2.ok && ct2.includes('image')) {
          imageBuffer = await r2.buffer();
        }
      } catch {}
    }

    if (!imageBuffer) throw new Error('All screenshot APIs failed');

    await sock.sendMessage(chatId, { image: imageBuffer }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[SS] error:', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */
module.exports = {
  name: 'ss',
  aliases: ['ss', 'ssweb', 'screenshot', 'سكرين', 'تصوير', 'لقطة'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  emoji: '📸',
  description: {
    ar: 'تصوير صفحة ويب وإرسال لقطة شاشة.',
    en: 'Take a screenshot of a web page and send it.'
  },
  usage: {
    ar: '.ss <url>',
    en: '.ss <url>'
  },
  admin: false,
  owner: false,
  showInMenu: true,
  exec: ssCommand,
  run: ssCommand,
  execute: (sock, message, args) => ssCommand(sock, message, args)
};