const fs = require('fs');
const path = require('path');
const { getLang } = require('../../lib/lang');

const warningsFilePath = path.join(process.cwd(), 'data', 'warnings.json');

function ensureWarningsFile() {
  const dir = path.dirname(warningsFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(warningsFilePath)) fs.writeFileSync(warningsFilePath, JSON.stringify({}, null, 2), 'utf8');
}

function loadWarningsSafe() {
  try {
    ensureWarningsFile();
    const data = fs.readFileSync(warningsFilePath, 'utf8') || '{}';
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

function extractTarget(message, args) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  if (mentioned.length) return mentioned[0];
  if (ctx.participant) return ctx.participant;

  const rawArgs = Array.isArray(args) && args.length ? args : null;
  const rawText = getText(message).trim();
  const used = (rawText.split(/\s+/)[0] || 'warnings').trim();
  const rest = rawText.slice(used.length).trim();
  const parts = rawArgs || (rest ? rest.split(/\s+/) : []);
  const num = String(parts?.[0] || '').replace(/[^\d]/g, '');
  if (num.length >= 8) return `${num}@s.whatsapp.net`;

  return null;
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const dict = {
    en: {
      onlyGroups: 'This command can only be used in groups.',
      needTarget: 'ℹ️ Mention a user, reply to their message, or write a number to check warnings.',
      none: (u) => `@${u} has 0 warning(s).`,
      count: (u, c) => `@${u} has ${c} warning(s).`,
      failed: '❌ Failed to fetch warnings.'
    },
    ar: {
      onlyGroups: 'الأمر ده شغال في الجروبات بس.',
      needTarget: 'ℹ️ منشن الشخص أو اعمل ريبلاي على رسالته أو اكتب رقم عشان تشوف التحذيرات.',
      none: (u) => `@${u} عليه 0 تحذير.`,
      count: (u, c) => `@${u} عليه ${c} تحذير.`,
      failed: '❌ حصل خطأ ومقدرتش أجيب التحذيرات.'
    }
  };
  return dict[lang] || dict.en;
}

async function warningsCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const T = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.onlyGroups }, { quoted: message });
    return;
  }

  const target = extractTarget(message, args);

  if (!target) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.needTarget }, { quoted: message });
    return;
  }

  try {
    await safeReact(sock, chatId, message.key, '📋');

    const warnings = loadWarningsSafe();
    const warningCount = Number(warnings?.[chatId]?.[target] || 0);

    const userNum = String(target).split('@')[0];
    const replyText = warningCount > 0 ? T.count(userNum, warningCount) : T.none(userNum);

    await sock.sendMessage(chatId, { text: replyText, mentions: [target] }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('[WARNINGS] error:', error?.message || error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'warnings',
  aliases: ['warns', 'تحذيرات', 'انذارات', 'إنذارات'],

  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },

  description: {
    ar: 'عرض عدد تحذيرات عضو داخل الجروب.',
    en: 'Show how many warnings a member has in the group.'
  },

  usage: {
    ar: '.warnings @user | (reply) | رقم',
    en: '.warnings @user | (reply) | number'
  },
emoji: '📝',
  admin: true,
  owner: false,
  showInMenu: true,

  exec: warningsCommand,
  run: warningsCommand,
  execute: (sock, message, args) => warningsCommand(sock, message, args),

  warningsCommand
};