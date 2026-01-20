const os = require('os');

const fs = require('fs');

const path = require('path');

const settings = require('../../settings');

const { getLang } = require('../../lib/lang');

/*

  Alive Command

  - Shows bot status, version, RAM, group language, server info, and menu hint

*/

function formatMB(bytes) {

  return (bytes / 1024 / 1024).toFixed(2);

}

function normalizeLang(lang) {

  const l = String(lang || '').toLowerCase();

  return l.startsWith('ar') ? 'ar' : 'en';

}

async function aliveCommand(sock, message) {

  const chatId = message.key.remoteJid;

  const lang = normalizeLang(getLang(chatId));

  // System info

  const ram = formatMB(process.memoryUsage().rss);

  const platform = os.platform();

  const arch = os.arch();

  const nodeVer = process.version;

  const TXT = {

    en: {

      title: '🤖 EasyStep Bot',

      status: 'Status',

      statusVal: 'Online',

      version: 'Version',

      ram: 'RAM Usage',

      lang: 'Group Language',

      server: 'Server',

      hint: '📜 Type: menu\nTo see all commands'

    },

    ar: {

      title: '🤖 بوت EasyStep',

      status: 'الحالة',

      statusVal: 'شغّال',

      version: 'الإصدار',

      ram: 'استهلاك الرام',

      lang: 'لغة الجروب',

      server: 'السيرفر',

      hint: '📜 اكتب: menu\nلعرض جميع الأوامر'

    }

  };

  const T = TXT[lang] || TXT.en;

  const text = `

${T.title}

━━━━━━━━━━━━━━

🟢 *${T.status}* : ${T.statusVal}

📦 *${T.version}* : ${settings.version || '3.0.0'}

💾 *${T.ram}* : ${ram} MB

🌐 *${T.lang}* : ${lang === 'ar' ? 'العربية' : 'English'}

🖥️ *${T.server}* : ${platform}/${arch}

🧩 Node : ${nodeVer}

━━━━━━━━━━━━━━

${T.hint}

`.trim();

  // React مناسب

  try {

    await sock.sendMessage(chatId, {

      react: { text: '🤖', key: message.key }

    });

  } catch {}

  // ===== LOGO SEND =====

  const logoPath = path.join(process.cwd(), 'assets', 'bot_image.jpg');

  if (fs.existsSync(logoPath)) {

    // صورة + كابشن

    await sock.sendMessage(

      chatId,

      {

        image: fs.readFileSync(logoPath),

        caption: text

      },

      { quoted: message }

    );

  } else {

    // fallback نص عادي

    await sock.sendMessage(chatId, { text }, { quoted: message });

  }

}

module.exports = {

  name: 'bot',

  aliases: ['bot', 'شغال', 'بوت'],

  category: {

    ar: '🌐 أوامر عامة',

    en: '🌐 General Commands'

  },

  description: {

    ar: 'عرض حالة البوت، الرام، لغة الجروب، والسيرفر مع لوجو البوت.',

    en: 'Show bot status, RAM usage, group language, server info with bot logo.'

  },

  usage: {

    ar: '.بوت',

    en: '.bot'

  },
emoji: '🕵🏻‍♂️',

  admin: false,

  owner: false,

  showInMenu: true,

  exec: aliveCommand,

  run: aliveCommand,

  execute: aliveCommand

};