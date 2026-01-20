const { setLang, getLang } = require('../../lib/lang');
const isAdmin = require('../../lib/isAdmin');

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

function extractArg(message, args = []) {
  const first = String(args?.[0] || '').toLowerCase().trim();
  if (first) return first;

  const raw = getRawText(message);
  const used = (raw.split(/\s+/)[0] || '.lang').trim();
  return raw.slice(used.length).trim().split(/\s+/)[0]?.toLowerCase() || '';
}

async function langCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);
  await safeReact(sock, chatId, message.key, '🌐');

  if (!chatId.endsWith('@g.us')) {
    const msg = lang === 'ar' ? '❌ الأمر ده شغال في الجروبات بس.' : '❌ This command can only be used in groups.';
    await safeReact(sock, chatId, message.key, '❌');
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
  }

  const senderId = message.key.participant || chatId;
  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);
  const okAdmin = adminStatus?.isSenderAdmin || message.key.fromMe;

  if (!okAdmin) {
    const msg = lang === 'ar' ? '❌ الأمر ده للأدمنية بس.' : '❌ Admins only.';
    await safeReact(sock, chatId, message.key, '🚫');
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
  }

  const pick = extractArg(message, args);

  if (!pick) {
    const msg =
      (lang === 'ar'
        ? `🌐 اللغة الحالية في الجروب: *${lang === 'ar' ? 'العربية' : 'الإنجليزية'}*`
        : `🌐 Current group language: *${lang === 'ar' ? 'Arabic' : 'English'}*`) +
      `\n\n` +
      (lang === 'ar'
        ? `اكتب:\n.lang ar لاختيار العربية\n.lang en لاختيار الإنجليزية`
        : `Use:\n.lang ar to select Arabic\n.lang en to select English`);

    await safeReact(sock, chatId, message.key, '✅');
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
  }

  if (pick !== 'en' && pick !== 'ar') {
    const msg =
      lang === 'ar'
        ? '❌ اختيار غير صحيح.\nاستخدم:\n.lang ar\n.lang en'
        : '❌ Invalid choice.\nUse:\n.lang ar\n.lang en';

    await safeReact(sock, chatId, message.key, '❌');
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
  }

  setLang(chatId, pick);

  const done =
    pick === 'ar'
      ? '✅ تم تغيير اللغة المستخدمة في الجروب إلى العربية.'
      : '✅ The language used in this group has been set to English.';

  await safeReact(sock, chatId, message.key, '✅');
  return sock.sendMessage(chatId, { text: done }, { quoted: message });
}

/* =========  Metadata (DO NOT edit above this line)  ========= */
module.exports = {
  name: 'lang',
  aliases: ['lang', 'language', 'لغة'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  description: {
    ar: 'تغيير لغة الجروب (عربي/إنجليزي) أو عرض اللغة الحالية.',
    en: 'Change group language (Arabic/English) or show current language.'
  },
  usage: {
    ar: '.lang ar | .lang en',
    en: '.lang ar | .lang en'
  },
  admin: true,
  owner: false,
  showInMenu: true,
  exec: langCommand,
  run: langCommand,
  execute: (sock, message, args) => langCommand(sock, message, args)
};
