const isAdmin = require('../../lib/isAdmin');

const { getLang } = require('../../lib/lang');

const timers = new Map();

function TXT(chatId) {

  const ar = getLang(chatId) === 'ar';

  return {

    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command can only be used in groups.',

    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',

    needSenderAdmin: ar ? '❌ الأمر ده للأدمنية بس.' : '❌ Only group admins can use this command.',

    help: ar

      ? '*إدارة الميوت*\n\n• .mute [دقايق]\n• .unmute [دقايق]\n\nملحوظة: لو كتبت وقت، بيتعمل مؤقت ويشتغل تلقائي.'

      : '*Mute Control*\n\n• .mute [minutes]\n• .unmute [minutes]\n\nNote: If minutes provided, a timer will auto-toggle.',

    invalidMin: ar ? '❌ الوقت لازم يكون رقم بالدقائق (مثال: .mute 5)' : '❌ Minutes must be a number (e.g. .mute 5)',

    muted: ar ? '🔇 تم قفل الجروب (ميوت).' : '🔇 Group has been muted.',

    unmuted: ar ? '🔊 تم فتح الجروب.' : '🔊 Group has been unmuted.',

    mutedFor: (m) => (ar ? `🔇 تم قفل الجروب لمدة ${m} دقيقة.` : `🔇 Group has been muted for ${m} minutes.`),

    unmutedFor: (m) => (ar ? `🔊 تم فتح الجروب لمدة ${m} دقيقة.` : `🔊 Group has been unmuted for ${m} minutes.`),

    timerCleared: ar ? '⏱️ تم إلغاء المؤقت القديم.' : '⏱️ Previous timer cleared.',

    err: ar ? '❌ حصل خطأ. جرّب تاني.' : '❌ An error occurred. Please try again.'

  };

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

async function handle(sock, chatId, message, args = [], senderId, isSenderAdmin) {

  if (!chatId) return;

  const T = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message });

    return;

  }

  const realSenderId = senderId || message?.key?.participant || chatId;

  const adminStatus = await isAdmin(sock, chatId, realSenderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message });

    return;

  }

  const senderAdmin = typeof isSenderAdmin === 'boolean' ? isSenderAdmin : !!adminStatus?.isSenderAdmin;

  if (!senderAdmin && !message?.key?.fromMe) {

    await safeReact(sock, chatId, message?.key, '🚫');

    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message });

    return;

  }

  const raw = getText(message).trim();

  const used = (raw.split(/\s+/)[0] || '').toLowerCase();

  const cmd = used.startsWith('.') ? used.slice(1) : used;

  const inferredArgs =

    Array.isArray(args) && args.length ? args : raw.slice(used.length).trim().split(/\s+/).filter(Boolean);

  const isMute = cmd === 'mute' || cmd === 'ميوت' || cmd === 'قفل';

  const isUnmute = cmd === 'unmute' || cmd === 'فتح' || cmd === 'فك_الميوت';

  if (!isMute && !isUnmute) {

    await safeReact(sock, chatId, message?.key, 'ℹ️');

    await sock.sendMessage(chatId, { text: T.help }, { quoted: message });

    return;

  }

  const minutesArg = inferredArgs?.[0];

  const minutes = parseMinutes(minutesArg);

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

    if (isMute) {

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

    if (isUnmute) {

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

  } catch (error) {

    console.error('mute/unmute error:', error);

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.err }, { quoted: message });

  }

}

module.exports = {

  name: 'mute',

  commands: ['mute', 'unmute'],

  aliases: ['ميوت', 'قفل', 'فتح', 'فك_الميوت'],

  category: {

    ar: '👮‍♂️ أدمن الجروب',

    en: '👮‍♂️ Group Admin'

  },

  description: {

    ar: 'قفل/فتح الجروب (Mute/Unmute) مع مدة اختيارية بالدقائق.',

    en: 'Mute/Unmute the group with optional duration in minutes.'

  },

  usage: {

    ar: '.mute [دقايق]\n.unmute [دقايق]',

    en: '.mute [minutes]\n.unmute [minutes]'

  },

  emoji: '🤐',

  admin: true,

  owner: false,

  showInMenu: true,

  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),

  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),

  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args)

};