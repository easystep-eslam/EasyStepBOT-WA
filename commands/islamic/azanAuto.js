const azanAuto = require('../../lib/azanAuto');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

async function azanautoCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '🕌', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      adminOnly: '🚫 This command is for group admins only.',
      usage:
        '*Auto Azan Control*\n' +
        '━━━━━━━━━━━━━━\n' +
        '.azanauto on cairo\n' +
        '.azanauto on alexandria\n' +
        '.azanauto off\n' +
        '━━━━━━━━━━━━━━\n' +
        '📍 If no city is provided → default: cairo',
      enabled: (city) => `✅ Auto azan has been enabled.\n📍 City: *${city}*`,
      disabled: '⛔ Auto azan has been disabled.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      adminOnly: '🚫 الأمر ده للأدمنز بس.',
      usage:
        '*التحكم في الأذان التلقائي*\n' +
        '━━━━━━━━━━━━━━\n' +
        '.azanauto on cairo\n' +
        '.azanauto on alexandria\n' +
        '.azanauto off\n' +
        '━━━━━━━━━━━━━━\n' +
        '📍 لو ما اخترتش مدينة → القاهرة افتراضي',
      enabled: (city) => `✅ تم تشغيل الأذان التلقائي.\n📍 المدينة: *${city}*`,
      disabled: '⛔ تم إيقاف الأذان التلقائي.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    if (!chatId.endsWith('@g.us')) {
      return await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    }

    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isSenderAdmin && !message.key.fromMe) {
      return await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    }

    const option = String(args?.[0] || '').toLowerCase();
    const city = String(args?.[1] || 'cairo').toLowerCase();

    if (!option || !['on', 'off'].includes(option)) {
      return await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    }

    if (option === 'on') {
      azanAuto.enable(chatId, city);
      return await sock.sendMessage(chatId, {
        react: { text: '✅', key: message.key }
      }).catch(async () => {
        await sock.sendMessage(chatId, { text: T.enabled(city) }, { quoted: message });
      }).then(async () => {
        await sock.sendMessage(chatId, { text: T.enabled(city) }, { quoted: message });
      });
    }

    azanAuto.disable(chatId);
    await sock.sendMessage(chatId, {
      react: { text: '🔕', key: message.key }
    }).catch(() => {});
    return await sock.sendMessage(chatId, { text: T.disabled }, { quoted: message });

  } catch (e) {
    console.error('AZANAUTO ERROR:', e);
    const errMsg = lang === 'ar' ? '❌ حصل خطأ أثناء تنفيذ الأمر.' : '❌ Error while processing command.';
    return await sock.sendMessage(chatId, { text: errMsg }, { quoted: message });
  }
}

module.exports = {
  name: 'azanauto',
  aliases: ['azanauto', 'azanau', 'اذان_اوتو'],
  category: {
    ar: '🕌 أوامر إسلامية',
    en: '🕌 Islamic Commands'
  },
  description: {
    ar: 'تشغيل/إيقاف الأذان التلقائي للجروب مع اختيار مدينة',
    en: 'Enable/disable auto azan per group with an optional city'
  },
  emoji: '⏰🕌',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: azanautoCommand
};