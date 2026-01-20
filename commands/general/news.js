const axios = require('axios');
const { getLang } = require('../../lib/lang');

// لمنع تكرار نفس الخبر أثناء تشغيل البوت
let lastTitleAR = null;
let lastTitleEN = null;

async function newsCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    ar: {
      noNews: 'لا توجد أخبار متاحة حالياً.',
      failed: 'حدث خطأ أثناء جلب الأخبار.',
      header: '📰 آخر الأخبار',
      footer: 'EasyStep Bot'
    },
    en: {
      noNews: 'No news available at the moment.',
      failed: 'An error occurred while fetching news.',
      header: '📰 Latest News',
      footer: 'EasyStep Bot'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    // React مناسب
    try {
      await sock.sendMessage(chatId, { react: { text: '📰', key: message.key } });
    } catch {}

    // =========================
    // 🇪🇬 عربي → اليوم السابع RSS
    // =========================
    if (lang === 'ar') {
      const res = await axios.get('https://www.youm7.com/rss/SectionRss?SectionID=65', {
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const xml = String(res.data || '');
      const items = xml.match(/<item>[\s\S]*?<\/item>/g);

      if (!items || items.length === 0) {
        await sock.sendMessage(chatId, { text: T.noNews }, { quoted: message });
        return;
      }

      let title = null;
      let description = null;

      for (const item of items) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);

        if (!titleMatch || !descMatch) continue;

        const t = String(titleMatch[1] || '').trim();
        if (!t) continue;
        if (t === lastTitleAR) continue;

        title = t;
        description = String(descMatch[1] || '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        break;
      }

      if (!title || !description) {
        await sock.sendMessage(chatId, { text: T.noNews }, { quoted: message });
        return;
      }

      lastTitleAR = title;

      const out = `
${T.header}

━━━━━━━━━━━━━━━

${title}

${description}

━━━━━━━━━━━━━━━

${T.footer}
      `.trim();

      await sock.sendMessage(chatId, { text: out }, { quoted: message });
      return;
    }

    // =========================
    // 🇺🇸 English → NewsAPI
    // =========================
    const apiKey = process.env.NEWS_API_KEY || 'dcd720a6f1914e2d9dba9790c188c08c';

    const res = await axios.get(
      `https://newsapi.org/v2/top-headlines?country=us&pageSize=5&apiKey=${apiKey}`,
      { timeout: 20000 }
    );

    const articles = res.data?.articles || [];
    if (!Array.isArray(articles) || articles.length === 0) {
      await sock.sendMessage(chatId, { text: T.noNews }, { quoted: message });
      return;
    }

    let article = null;
    for (const a of articles) {
      const title = String(a?.title || '').trim();
      if (!title) continue;
      if (title === lastTitleEN) continue;
      article = a;
      break;
    }

    if (!article) {
      await sock.sendMessage(chatId, { text: T.noNews }, { quoted: message });
      return;
    }

    lastTitleEN = String(article.title || '').trim();

    const out = `
${T.header}

━━━━━━━━━━━━━━━

${article.title}

${article.description || ''}

━━━━━━━━━━━━━━━

${T.footer}
    `.trim();

    await sock.sendMessage(chatId, { text: out }, { quoted: message });
  } catch (err) {
    console.error('news command error:', err?.message || err);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'news',
  aliases: ['news', 'اخبار', 'جريدة'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'جلب آخر الأخبار حسب لغة الجروب.',
    en: 'Fetch latest news based on group language.'
  },
  usage: {
    ar: '.news',
    en: '.news'
  },
  emoji: '📰',
  admin: false,
  owner: false,
  showInMenu: true,

  run: newsCommand,
  exec: newsCommand
};