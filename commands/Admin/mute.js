const isAdmin = require('../../lib/isAdmin');

const { getLang } = require('../../lib/lang');

const timers = new Map();

function TXT(chatId) {

  const ar = getLang(chatId) === 'ar';

  return {

    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command can only be used in groups.',

    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',

    needSenderAdmin: ar ? '❌ الأمر ده للأدمنية بس.' : '❌ Only group admins can use this command.',

    invalidMin: ar ? '❌ الوقت لازم يكون رقم بالدقائق (مثال: .mute 5)' : '❌ Minutes must be a number (e.g. .mute 5)',

    muted: ar ? '🔇 تم قفل الجروب (ميوت).' : '🔇 Group has been muted.',

    mutedFor: (m) => ar

      ? `🔇 تم قفل الجروب لمدة ${m} دقيقة.`

      : `🔇 Group has been muted for ${m} minutes.`,

    autoUnmute: ar ? '🔊 تم فتح الجروب تلقائيًا.' : '🔊 Group has been auto-unmuted.',

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

  if (!arg) return null;

  const n = Number(arg);

  if (!Number.isFinite(n) || n <= 0) return NaN;

  return Math.floor(n);

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

    await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message });

    return;

  }

  const realSenderId =

    senderId ||

    message?.key?.participant ||

    message?.participant ||

    message?.key?.remoteJid;

  const adminStatus = await isAdmin(sock, chatId, realSenderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {

    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message });

    return;

  }

  const senderAdmin =

    typeof isSenderAdmin === 'boolean'

      ? isSenderAdmin

      : !!adminStatus?.isSenderAdmin;

  if (!senderAdmin && !message?.key?.fromMe) {

    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message });

    return;

  }

  const raw = getText(message).trim();

  const used = (raw.split(/\s+/)[0] || '').toLowerCase();

  const cmd = used.startsWith('.') ? used.slice(1) : used;

  if (!['mute', 'ميوت', 'قفل'].includes(cmd)) return;

  const minutesArg = args?.[0];

  const minutes = parseMinutes(minutesArg);

  if (minutesArg && Number.isNaN(minutes)) {

    await sock.sendMessage(chatId, { text: T.invalidMin }, { quoted: message });

    return;

  }

  if (clearExistingTimer(chatId)) {

    await sock.sendMessage(chatId, { text: T.timerCleared }, { quoted: message });

  }

  try {

    await setAnnouncement(sock, chatId, true);

    if (minutes) {

      await sock.sendMessage(chatId, { text: T.mutedFor(minutes) }, { quoted: message });

      const id = setTimeout(async () => {

        try {

          await setAnnouncement(sock, chatId, false);

          await sock.sendMessage(chatId, { text: T.autoUnmute });

        } finally {

          timers.delete(chatId);

        }

      }, minutes * 60 * 1000);

      timers.set(chatId, id);

      return;

    }

    await sock.sendMessage(chatId, { text: T.muted }, { quoted: message });

  } catch (e) {

    console.error('mute error:', e);

    await sock.sendMessage(chatId, { text: T.err }, { quoted: message });

  }

}

module.exports = {

  name: 'mute',

  commands: ['mute', 'ميوت', 'قفل'],

  aliases: ['ميوت', 'قفل'],

  category: {

    ar: '👮‍♂️ أدمن الجروب',

    en: '👮‍♂️ Group Admin'

  },

  description: {

    ar: 'قفل الجروب (ميوت) مع مدة اختيارية.',

    en: 'Mute the group with optional duration.'

  },

  usage: {

    ar: '.mute [دقايق]',

    en: '.mute [minutes]'

  },

  emoji: '🔇',

  admin: true,

  owner: false,

  showInMenu: true,

  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),

  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),

  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args)

};