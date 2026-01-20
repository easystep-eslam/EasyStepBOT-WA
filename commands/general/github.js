const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

async function githubCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      title: '*乂  EasyStep Bot  乂*',
      name: 'Name',
      watchers: 'Watchers',
      size: 'Size',
      updated: 'Last Updated',
      url: 'URL',
      forks: 'Forks',
      stars: 'Stars',
      footer: '💥 EasyStep Bot',
      error: '❌ Error fetching repository information.'
    },
    ar: {
      title: '*乂  بوت EasyStep  乂*',
      name: 'الاسم',
      watchers: 'المتابعين',
      size: 'الحجم',
      updated: 'آخر تحديث',
      url: 'الرابط',
      forks: 'التفريعات',
      stars: 'النجوم',
      footer: '💥 بوت EasyStep',
      error: '❌ حصل خطأ أثناء جلب معلومات المستودع.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await sock.sendMessage(chatId, { react: { text: '🐙', key: message.key } }).catch(() => {});

    const res = await fetch('https://api.github.com/repos/eslamSamo/EasyStep-bot', {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'EasyStep-BOT'
      }
    });

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const json = await res.json();

    const sizeMB = Number(json.size || 0) / 1024;
    const updatedAt = json.updated_at
      ? moment(json.updated_at).tz('Africa/Cairo').format('DD/MM/YY - HH:mm:ss')
      : '--';

    let txt = `${T.title}\n\n`;
    txt += `✩  *${T.name}* : ${json.name || 'EasyStep-bot'}\n`;
    txt += `✩  *${T.watchers}* : ${json.watchers_count ?? 0}\n`;
    txt += `✩  *${T.size}* : ${sizeMB.toFixed(2)} MB\n`;
    txt += `✩  *${T.updated}* : ${updatedAt}\n`;
    txt += `✩  *${T.url}* : ${json.html_url || '--'}\n`;
    txt += `✩  *${T.forks}* : ${json.forks_count ?? 0}\n`;
    txt += `✩  *${T.stars}* : ${json.stargazers_count ?? 0}\n\n`;
    txt += `${T.footer}`;

    const imgPath = path.join(__dirname, '../../assets/bot_image.jpg');

    if (fs.existsSync(imgPath)) {
      await sock.sendMessage(chatId, { image: fs.readFileSync(imgPath), caption: txt }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: txt }, { quoted: message });
  } catch (error) {
    console.error('[GITHUB]', error?.message || error);
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'github',
  aliases: ['github', 'جيتهاب', 'جيت_هاب'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'يعرض معلومات مستودع البوت على GitHub.',
    en: 'Shows the bot repository info on GitHub.'
  },
  usage: {
    ar: '.github',
    en: '.github'
  },
  emoji: '💻',
  admin: false,
  owner: false,
  showInMenu: false,
  run: githubCommand
};