const {

  addWelcome,

  delWelcome,

  isWelcomeOn,

  getWelcome,

  addGoodbye,

  delGoodBye,

  isGoodByeOn,

  getGoodbye

} = require('../lib/index');

const isAdmin = require('../lib/isAdmin');

const { getLang } = require('../lib/lang');

function isGroupJid(jid = '') {

  const x = String(jid || '');

  return x.endsWith('@g.us') || x.endsWith('@lid');

}

function normalizeGroupId(jid = '') {

  const x = String(jid || '').trim();

  if (!x) return x;

  if (x.endsWith('@g.us')) return x;

  if (x.endsWith('@lid')) return x;

  return x;

}

async function safeReact(sock, chatId, key, emoji) {

  try {

    if (!key) return;

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

async function ensureAdmin(sock, chatId, message) {

  const senderId = message?.key?.participant || message?.key?.remoteJid;

  try {

    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isSenderAdmin && !message.key.fromMe) return false;

    return true;

  } catch {

    return false;

  }

}

/* ===================== WELCOME ===================== */

async function handleWelcome(sock, chatId, message, match) {

  const gid = normalizeGroupId(chatId);

  const lang = getLang(gid);

  const TXT = {

    en: {

      onlyGroup: '❌ This command works in groups only.',

      onlyAdmins: '❌ This command is for group admins only.',

      help:

        `👋 *Welcome Settings*\n\n` +

        `• *.welcome on*  — Enable\n` +

        `• *.welcome set <message>*  — Set custom message\n` +

        `• *.welcome off* — Disable\n\n` +

        `📌 Variables (use @):\n` +

        `@name = new member mention\n` +

        `@number = member number\n` +

        `@group = group name\n` +

        `@description = group description\n` +

        `@count = member count\n` +

        `@date = date\n` +

        `@time = time\n` +

        `@datetime = date + time`,

      alreadyOn: 'ℹ️ Welcome is already enabled.',

      turnedOn: '✅ Welcome enabled.\n📌 Use: *.welcome set <message>* to customize.',

      alreadyOff: 'ℹ️ Welcome is already disabled.',

      turnedOff: '✅ Welcome disabled for this group.',

      needSet:

        '⚠️ Please write the welcome message after *set*.\nExample:\n' +

        '.welcome set Welcome @name 👋\n' +

        'Group: @group\n' +

        'Time: @datetime',

      saved: '✅ Welcome message saved successfully.',

      wrong:

        `❌ Invalid option.\nUse:\n` +

        `.welcome on\n` +

        `.welcome set <message>\n` +

        `.welcome off`

    },

    ar: {

      onlyGroup: '❌ الأمر ده بيشتغل في الجروبات فقط.',

      onlyAdmins: '❌ الأمر ده لمشرفين الجروب فقط.',

      help:

        `👋 *إعدادات الترحيب*\n\n` +

        `• *.welcome on*  — تشغيل\n` +

        `• *.welcome set <رسالة>*  — تعيين رسالة مخصصة\n` +

        `• *.welcome off* — إيقاف\n\n` +

        `📌 المتغيرات (استخدم @):\n` +

        `@name = منشن العضو الجديد\n` +

        `@number = رقم العضو\n` +

        `@group = اسم الجروب\n` +

        `@description = وصف الجروب\n` +

        `@count = عدد الأعضاء\n` +

        `@date = التاريخ\n` +

        `@time = الوقت\n` +

        `@datetime = تاريخ + وقت`,

      alreadyOn: 'ℹ️ الترحيب مفعل بالفعل.',

      turnedOn: '✅ تم تفعيل الترحيب.\n📌 استخدم: *.welcome set <رسالة>* للتخصيص.',

      alreadyOff: 'ℹ️ الترحيب غير مفعل حاليًا.',

      turnedOff: '✅ تم إيقاف الترحيب في هذا الجروب.',

      needSet:

        '⚠️ من فضلك اكتب رسالة الترحيب بعد كلمة *set*.\nمثال:\n' +

        '.welcome set أهلاً @name 👋\n' +

        'اسم الجروب: @group\n' +

        'الوقت: @datetime',

      saved: '✅ تم حفظ رسالة الترحيب بنجاح.',

      wrong:

        `❌ اختيار غير صحيح.\nاستخدم:\n` +

        `.welcome on\n` +

        `.welcome set <رسالة>\n` +

        `.welcome off`

    }

  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, gid, message?.key, '👋');

  if (!isGroupJid(gid)) {

    await sock.sendMessage(gid, { text: T.onlyGroup }, { quoted: message });

    return;

  }

  const okAdmin = await ensureAdmin(sock, gid, message);

  if (!okAdmin) {

    await sock.sendMessage(gid, { text: T.onlyAdmins }, { quoted: message });

    return;

  }

  if (!match) {

    await sock.sendMessage(gid, { text: T.help }, { quoted: message });

    return;

  }

  const parts = String(match || '').trim().split(/\s+/);

  const cmd = (parts[0] || '').toLowerCase();

  const customMessage = parts.slice(1).join(' ').trim();

  if (cmd === 'on') {

    if (await isWelcomeOn(gid)) {

      await sock.sendMessage(gid, { text: T.alreadyOn }, { quoted: message });

      return;

    }

    const def =

      lang === 'en'

        ? 'Welcome @name to @group 🎉\nMembers: #@count\nTime: @datetime'

        : 'أهلاً @name نورت جروب @group 🎉\nعدد الأعضاء: #@count\nالوقت: @datetime';

    await addWelcome(gid, true, def);

    await sock.sendMessage(gid, { text: T.turnedOn }, { quoted: message });

    return;

  }

  if (cmd === 'off') {

    if (!(await isWelcomeOn(gid))) {

      await sock.sendMessage(gid, { text: T.alreadyOff }, { quoted: message });

      return;

    }

    await delWelcome(gid);

    await sock.sendMessage(gid, { text: T.turnedOff }, { quoted: message });

    return;

  }

  if (cmd === 'set') {

    if (!customMessage) {

      await sock.sendMessage(gid, { text: T.needSet }, { quoted: message });

      return;

    }

    await addWelcome(gid, true, customMessage);

    await sock.sendMessage(gid, { text: T.saved }, { quoted: message });

    return;

  }

  await sock.sendMessage(gid, { text: T.wrong }, { quoted: message });

}

/* ===================== GOODBYE ===================== */

async function handleGoodbye(sock, chatId, message, match) {

  const gid = normalizeGroupId(chatId);

  const lang = getLang(gid);

  const TXT = {

    en: {

      onlyGroup: '❌ This command works in groups only.',

      onlyAdmins: '❌ This command is for group admins only.',

      help:

        `🚪 *Goodbye Settings*\n\n` +

        `• *.goodbye on*  — Enable\n` +

        `• *.goodbye set <message>*  — Set custom message\n` +

        `• *.goodbye off* — Disable\n\n` +

        `📌 Variables (use @):\n` +

        `@name = leaving member mention\n` +

        `@number = member number\n` +

        `@group = group name\n` +

        `@count = member count\n` +

        `@date = date\n` +

        `@time = time\n` +

        `@datetime = date + time`,

      alreadyOn: 'ℹ️ Goodbye is already enabled.',

      turnedOn: '✅ Goodbye enabled.\n📌 Use: *.goodbye set <message>* to customize.',

      alreadyOff: 'ℹ️ Goodbye is already disabled.',

      turnedOff: '✅ Goodbye disabled for this group.',

      needSet:

        '⚠️ Please write the goodbye message after *set*.\nExample:\n' +

        '.goodbye set Goodbye @name 👋\n' +

        'Time: @datetime',

      saved: '✅ Goodbye message saved successfully.',

      wrong:

        `❌ Invalid option.\nUse:\n` +

        `.goodbye on\n` +

        `.goodbye set <message>\n` +

        `.goodbye off`

    },

    ar: {

      onlyGroup: '❌ الأمر ده بيشتغل في الجروبات فقط.',

      onlyAdmins: '❌ الأمر ده لمشرفين الجروب فقط.',

      help:

        `🚪 *إعدادات الوداع*\n\n` +

        `• *.goodbye on*  — تشغيل\n` +

        `• *.goodbye set <رسالة>*  — تعيين رسالة مخصصة\n` +

        `• *.goodbye off* — إيقاف\n\n` +

        `📌 المتغيرات (استخدم @):\n` +

        `@name = منشن العضو اللي خرج\n` +

        `@number = رقم العضو\n` +

        `@group = اسم الجروب\n` +

        `@count = عدد الأعضاء\n` +

        `@date = التاريخ\n` +

        `@time = الوقت\n` +

        `@datetime = تاريخ + وقت`,

      alreadyOn: 'ℹ️ الوداع مفعل بالفعل.',

      turnedOn: '✅ تم تفعيل الوداع.\n📌 استخدم: *.goodbye set <رسالة>* للتخصيص.',

      alreadyOff: 'ℹ️ الوداع غير مفعل حاليًا.',

      turnedOff: '✅ تم إيقاف الوداع في هذا الجروب.',

      needSet:

        '⚠️ من فضلك اكتب رسالة الوداع بعد كلمة *set*.\nمثال:\n' +

        '.goodbye set مع السلامة يا @name 👋\n' +

        'الوقت: @datetime',

      saved: '✅ تم حفظ رسالة الوداع بنجاح.',

      wrong:

        `❌ اختيار غير صحيح.\nاستخدم:\n` +

        `.goodbye on\n` +

        `.goodbye set <رسالة>\n` +

        `.goodbye off`

    }

  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, gid, message?.key, '🚪');

  if (!isGroupJid(gid)) {

    await sock.sendMessage(gid, { text: T.onlyGroup }, { quoted: message });

    return;

  }

  const okAdmin = await ensureAdmin(sock, gid, message);

  if (!okAdmin) {

    await sock.sendMessage(gid, { text: T.onlyAdmins }, { quoted: message });

    return;

  }

  if (!match) {

    await sock.sendMessage(gid, { text: T.help }, { quoted: message });

    return;

  }

  const parts = String(match || '').trim().split(/\s+/);

  const cmd = (parts[0] || '').toLowerCase();

  const customMessage = parts.slice(1).join(' ').trim();

  if (cmd === 'on') {

    if (await isGoodByeOn(gid)) {

      await sock.sendMessage(gid, { text: T.alreadyOn }, { quoted: message });

      return;

    }

    const def =

      lang === 'en'

        ? 'Goodbye @name 👋\nTime: @datetime'

        : 'مع السلامة يا @name 👋\nالوقت: @datetime';

    await addGoodbye(gid, true, def);

    await sock.sendMessage(gid, { text: T.turnedOn }, { quoted: message });

    return;

  }

  if (cmd === 'off') {

    if (!(await isGoodByeOn(gid))) {

      await sock.sendMessage(gid, { text: T.alreadyOff }, { quoted: message });

      return;

    }

    await delGoodBye(gid);

    await sock.sendMessage(gid, { text: T.turnedOff }, { quoted: message });

    return;

  }

  if (cmd === 'set') {

    if (!customMessage) {

      await sock.sendMessage(gid, { text: T.needSet }, { quoted: message });

      return;

    }

    await addGoodbye(gid, true, customMessage);

    await sock.sendMessage(gid, { text: T.saved }, { quoted: message });

    return;

  }

  await sock.sendMessage(gid, { text: T.wrong }, { quoted: message });

}

module.exports = {

  handleWelcome,

  handleGoodbye

};