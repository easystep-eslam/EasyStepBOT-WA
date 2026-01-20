const isAdmin = require('../../lib/isAdmin');

const { getLang } = require('../../lib/lang');

const timers = new Map();

function getText(message) {

  return (

    message?.message?.conversation ||

    message?.message?.extendedTextMessage?.text ||

    message?.message?.imageMessage?.caption ||

    message?.message?.videoMessage?.caption ||

    ''

  );

}

function TXT(chatId) {

  const ar = getLang(chatId) === 'ar';

  return {

    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command is for groups only.',

    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',

    needSenderAdmin: ar ? '❌ الأمر ده للأدمنية بس.' : '❌ Only group admins can use this command.',

    invalidMin: ar ? '❌ الوقت لازم يكون رقم بالدقائق (مثال: .mute 5)' : '❌ Minutes must be a number (e.g. .mute 5)',

    muted: ar ? '🔇 تم قفل الجروب (ميوت).' : '🔇 The group has been muted.',

    unmuted: ar ? '🔊 تم فتح الجروب.' : '🔊 The group has been unmuted.',

    mutedFor: (m) => (ar ? `🔇 تم قفل الجروب لمدة ${m} دقيقة.` : `🔇 The group has been muted for ${m} minutes.`),

    unmutedFor: (m) => (ar ? `🔊 تم فتح الجروب لمدة ${m} دقيقة.` : `🔊 The group has been unmuted for ${m} minutes.`),

    timerCleared: ar ? '⏱️ تم إلغاء المؤقت القديم.' : '⏱️ Previous timer cleared.',

    err: ar ? '❌ حصل خطأ. جرّب تاني.' : '❌ An error occurred. Please try again.',

    usage: ar

      ? 'ℹ️ الاستخدام:\n• .mute [دقايق]\n• .unmute [دقايق]\n\nلو كتبت وقت، بيتعمل مؤقت للتبديل تلقائيًا.'

      : 'ℹ️ Usage:\n• .mute [minutes]\n• .unmute [minutes]\n\nIf minutes provided, a timer will auto-toggle.'

  };

}

function parseMinutes(arg) {

  if (arg === undefined || arg === null || arg === '') return null;

  const n = Number(String(arg).trim());

  if (!Number.isFinite(n) || n <= 0) return NaN;

  return Math.floor(n);

}

async function safeReact(sock, chatId, key, emoji) {

  if (!key) return;

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

async function setAnnouncement(sock, chatId, on) {

  await sock.groupSettingUpdate(chatId, on ? 'announcement' : 'not_announcement');

}

function clearExistingTimer(chatId) {

  const old = timers.get(chatId);

  if (!old) return false;

  clearTimeout(old);

  timers.delete(chatId);

  return true;

}

function getUsedCommand(message) {

  const raw = getText(message).trim();

  const first = (raw.split(/\s+/)[0] || '').toLowerCase();

  return first.startsWith('.') ? first.slice(1) : first;

}

function extractArgs(message, args) {

  if (Array.isArray(args) && args.length) return args;

  const raw = getText(message).trim();

  const used = (raw.split(/\s+/)[0] || '').trim();

  const rest = raw.slice(used.length).trim();

  return rest ? rest.split(/\s+/).filter(Boolean) : [];

}

function isUnmuteWord(word) {

  return ['unmute', 'فتح', 'فك_الميوت', 'فك-الميوت', 'unmute1', 'unmute2'].includes(word);

}

function isMuteWord(word) {

  return ['mute', 'ميوت', 'قفل', 'mute1', 'mute2'].includes(word);

}

async function handler(sock, chatId, message, args) {

  if (!chatId) return;

  const T = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message });

    return;

  }

  const realSenderId = message?.key?.participant || chatId;

  const adminStatus = await isAdmin(sock, chatId, realSenderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message });

    return;

  }

  if (!adminStatus?.isSenderAdmin && !message?.key?.fromMe) {

    await safeReact(sock, chatId, message?.key, '🚫');

    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message });

    return;

  }

  const usedCmd = getUsedCommand(message);

  const inferredArgs = extractArgs(message, args);

  const minutesArg = inferredArgs?.[0];

  const minutes = parseMinutes(minutesArg);

  const doMute = isMuteWord(usedCmd);

  const doUnmute = isUnmuteWord(usedCmd);

  if (!doMute && !doUnmute) {

    await safeReact(sock, chatId, message?.key, 'ℹ️');

    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });

    return;

  }

  if (minutesArg && Number.isNaN(minutes)) {

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.invalidMin }, { quoted: message });

    return;

  }

  const hadOld = clearExistingTimer(chatId);

  if (hadOld) {

    await safeReact(sock, chatId, message?.key, '⏱️');

    await sock.sendMessage(chatId, { text: T.timerCleared }, { quoted: message });

  }

  try {

    if (doMute) {

      await safeReact(sock, chatId, message?.key, '🔇');

      await setAnnouncement(sock, chatId, true);

      if (minutes) {

        await sock.sendMessage(chatId, { text: T.mutedFor(minutes) }, { quoted: message });

        const id = setTimeout(async () => {

          try {

            await setAnnouncement(sock, chatId, false);

            await sock.sendMessage(chatId, { text: T.unmuted });

          } catch {} finally {

            timers.delete(chatId);

          }

        }, minutes * 60 * 1000);

        timers.set(chatId, id);

        return;

      }

      await sock.sendMessage(chatId, { text: T.muted }, { quoted: message });

      return;

    }

    if (doUnmute) {

      await safeReact(sock, chatId, message?.key, '🔊');

      await setAnnouncement(sock, chatId, false);

      if (minutes) {

        await sock.sendMessage(chatId, { text: T.unmutedFor(minutes) }, { quoted: message });

        const id = setTimeout(async () => {

          try {

            await setAnnouncement(sock, chatId, true);

            await sock.sendMessage(chatId, { text: T.muted });

          } catch {} finally {

            timers.delete(chatId);

          }

        }, minutes * 60 * 1000);

        timers.set(chatId, id);

        return;

      }

      await sock.sendMessage(chatId, { text: T.unmuted }, { quoted: message });

      return;

    }

  } catch (e) {

    console.error('mute/unmute error:', e);

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.err }, { quoted: message });

  }

}

module.exports = {

  name: 'mute',

  aliases: ['unmute', 'ميوت', 'قفل', 'فتح', 'فك_الميوت'],

  category: {

    ar: '👮‍♂️ أدمن الجروب',

    en: '👮‍♂️ Group Admin'

  },

  description: {

    ar: 'قفل الجروب (ميوت) أو فتحه، مع إمكانية تحديد مدة بالدقائق للتبديل تلقائيًا.',

    en: 'Mute or unmute the group, with optional minutes to auto-toggle after the duration.'

  },

  usage: {

    ar: '.mute [دقايق]\n.unmute [دقايق]',

    en: '.mute [minutes]\n.unmute [minutes]'

  },

  emoji: '🤐',

  admin: true,

  owner: false,

  showInMenu: true,

  exec: async (sock, message, args) => {

    const chatId = message?.key?.remoteJid;

    return handler(sock, chatId, message, args);

  },

  run: async (sock, chatId, message, args) => {

    return handler(sock, chatId, message, args);

  },

  execute: async (sock, message, args) => {

    const chatId = message?.key?.remoteJid;

    return handler(sock, chatId, message, args);

  }

};