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

      ? '*فتح الجروب*\n\n• .unmute\n• .unmute [دقايق]\n\nملحوظة: لو كتبت وقت، بيتعمل مؤقت ويرجع يقفل تلقائي.'

      : '*Unmute*\n\n• .unmute\n• .unmute [minutes]\n\nNote: If minutes provided, a timer will auto-mute again.',

    invalidMin: ar ? '❌ الوقت لازم يكون رقم بالدقائق (مثال: .unmute 5)' : '❌ Minutes must be a number (e.g. .unmute 5)',

    unmuted: ar ? '🔊 تم فتح الجروب.' : '🔊 Group has been unmuted.',

    unmutedFor: (m) => (ar ? `🔊 تم فتح الجروب لمدة ${m} دقيقة.` : `🔊 Group has been unmuted for ${m} minutes.`),

    autoMuted: ar ? '🔇 تم قفل الجروب تلقائيًا.' : '🔇 Group has been auto-muted.',

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

function clearExistingTimer(chatId) {

  const old = timers.get(chatId);

  if (!old) return false;

  clearTimeout(old);

  timers.delete(chatId);

  return true;

}

async function setAnnouncement(sock, chatId, on) {

  await sock.groupSettingUpdate(chatId, on ? 'announcement' : 'not_announcement');

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

  // لو حد استدعى الملف بالغلط/منيو... نتحقق من الأمر

  const raw = getText(message).trim();

  const used = (raw.split(/\s+/)[0] || '').toLowerCase();

  const cmd = used.startsWith('.') ? used.slice(1) : used;

  const isUnmute = cmd === 'unmute' || cmd === 'فتح' || cmd === 'فك_الميوت';

  if (!isUnmute) {

    await sock.sendMessage(chatId, { text: T.help }, { quoted: message });

    return;

  }

  const minutesArg = Array.isArray(args) && args.length

    ? args[0]

    : raw.slice(used.length).trim().split(/\s+/).filter(Boolean)[0];

  const minutes = parseMinutes(minutesArg);

  if (minutesArg && Number.isNaN(minutes)) {

    await sock.sendMessage(chatId, { text: T.invalidMin }, { quoted: message });

    return;

  }

  if (clearExistingTimer(chatId)) {

    await sock.sendMessage(chatId, { text: T.timerCleared }, { quoted: message });

  }

  try {

    // فتح

    await setAnnouncement(sock, chatId, false);

    if (minutes) {

      await sock.sendMessage(chatId, { text: T.unmutedFor(minutes) }, { quoted: message });

      const id = setTimeout(async () => {

        try {

          await setAnnouncement(sock, chatId, true);

          await sock.sendMessage(chatId, { text: T.autoMuted });

        } catch {} finally {

          timers.delete(chatId);

        }

      }, minutes * 60 * 1000);

      timers.set(chatId, id);

      return;

    }

    await sock.sendMessage(chatId, { text: T.unmuted }, { quoted: message });

  } catch (e) {

    console.error('unmute error:', e);

    await sock.sendMessage(chatId, { text: T.err }, { quoted: message });

  }

}

module.exports = {

  name: 'unmute',

  commands: ['unmute', 'فتح', 'فك_الميوت'],

  aliases: ['فتح', 'فك_الميوت'],

  category: {

    ar: '👮‍♂️ أدمن الجروب',

    en: '👮‍♂️ Group Admin'

  },

  description: {

    ar: 'فتح الجروب (إلغاء الميوت) مع مدة اختيارية بالدقائق.',

    en: 'Unmute the group with optional duration in minutes.'

  },

  usage: {

    ar: '.unmute [دقايق]',

    en: '.unmute [minutes]'

  },

  emoji: '🔊',

  admin: true,

  owner: false,

  showInMenu: true,

  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),

  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),

  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args)

};