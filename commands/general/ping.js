const os = require('os');
const settings = require('../../settings');
const { getLang } = require('../../lib/lang');

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  sec %= 86400;
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return { d, h, m, s };
}

async function pingCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '⚡',
      head: 'BOT SPEED TEST',
      latency: 'Latency',
      uptime: 'Uptime',
      ram: 'RAM Usage',
      platform: 'Platform',
      cpu: 'Processor',
      version: 'Version',
      statusLabel: 'Status',
      statusText: 'Fully Active & Stable',
      footer: '© EasyStep',
      error: '❌ Failed to get bot status.'
    },
    ar: {
      react: '⚡',
      head: 'فحص سرعة البوت',
      latency: 'الاستجابة',
      uptime: 'مدة التشغيل',
      ram: 'استهلاك الرام',
      platform: 'النظام',
      cpu: 'المعالج',
      version: 'الإصدار',
      statusLabel: 'الحالة',
      statusText: 'يعمل بكفاءة واستقرار',
      footer: '© EasyStep',
      error: '❌ حصل خطأ أثناء فحص حالة البوت.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const start = Date.now();

    // React مناسب للأمر
    await sock.sendMessage(chatId, {
      react: { text: T.react, key: message.key }
    }).catch(() => {});

    const latency = Date.now() - start;

    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const platform = os.platform();
    const cpu = os.cpus()?.[0]?.model || 'Unknown';
    const version = settings.version || '3.0.0';

    const uptimeText =
      lang === 'ar'
        ? `${uptime.d}ي ${uptime.h}س ${uptime.m}د ${uptime.s}ث`
        : `${uptime.d}d ${uptime.h}h ${uptime.m}m ${uptime.s}s`;

    const text = `
┏━━━━━━┫ EasyStep-BOT ┣━━━━━━┓
┃ ⚡ *${T.head}*
┣━━━━━━━━━━━━━━━━━━━━━
┃ 🚀 *${T.latency}*  : ${latency} ms
┃ 🕒 *${T.uptime}*   : ${uptimeText}
┃ 💾 *${T.ram}*      : ${ram} MB
┃ 🖥️ *${T.platform}* : ${platform}
┃ ⚙️ *${T.cpu}*      : ${cpu}
┃ 📟 *${T.version}*  : v${version}
┣━━━━━━━━━━━━━━━━━━━━━
┃ 🟢 *${T.statusLabel}* : ${T.statusText}
┗━━━━━━━━━━━━━━━━━━━━━
> ${T.footer}
`.trim();

    await sock.sendMessage(chatId, { text }, { quoted: message });
  } catch (err) {
    console.error('[PING]', err);
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'ping',
  aliases: ['ping', 'speed', 'status', 'بنغ', 'حالة'],

  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
emoji: '⚡',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: pingCommand
};