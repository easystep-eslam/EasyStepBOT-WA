const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const KICKMSG_FILE = path.join(process.cwd(), 'data', 'kickmsg.json');

function ensureKickMsgFile() {
  try {
    const dir = path.dirname(KICKMSG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(KICKMSG_FILE)) fs.writeFileSync(KICKMSG_FILE, JSON.stringify({}, null, 2));
  } catch {}
}

function readKickMsg(chatId) {
  try {
    ensureKickMsgFile();
    const data = JSON.parse(fs.readFileSync(KICKMSG_FILE, 'utf8') || '{}') || {};
    return typeof data[chatId] === 'string' ? data[chatId] : null;
  } catch {
    return null;
  }
}

function writeKickMsg(chatId, text) {
  try {
    ensureKickMsgFile();
    const data = JSON.parse(fs.readFileSync(KICKMSG_FILE, 'utf8') || '{}') || {};
    const v = String(text || '').trim();
    if (!v) return false;
    data[chatId] = v;
    fs.writeFileSync(KICKMSG_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function removeKickMsg(chatId) {
  try {
    ensureKickMsgFile();
    const data = JSON.parse(fs.readFileSync(KICKMSG_FILE, 'utf8') || '{}') || {};
    delete data[chatId];
    fs.writeFileSync(KICKMSG_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
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

function extractTargets(message, args) {
  const ctx = message.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  const replied = ctx.participant ? [ctx.participant] : [];
  let targets = [...mentioned, ...replied].filter(Boolean);

  if (!targets.length && Array.isArray(args) && args.length) {
    const maybe = String(args[0] || '').replace(/[^\d]/g, '');
    if (maybe.length >= 8) targets = [`${maybe}@s.whatsapp.net`];
  }

  return [...new Set(targets)];
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function getDefaultKickTemplate(lang) {
  return lang === 'ar'
    ? '👢 تم طرد: {user}\n👑 بواسطة: {by}'
    : '👢 Kicked: {user}\n👑 By: {by}';
}

async function buildKickText(sock, chatId, lang, targets, senderId) {
  let groupName = '';
  try {
    const meta = await sock.groupMetadata(chatId);
    groupName = meta?.subject || '';
  } catch {}

  const userTags = targets.map(j => `@${String(j).split('@')[0]}`).join(', ');
  const byTag = `@${String(senderId).split('@')[0]}`;

  const custom = readKickMsg(chatId);
  const template = custom || getDefaultKickTemplate(lang);

  return String(template)
    .replace(/{user}/g, userTags)
    .replace(/{by}/g, byTag)
    .replace(/{group}/g, groupName);
}

function helpText(lang, defaultTemplate, currentCustom) {
  if (lang === 'ar') {
    const current =
      currentCustom
        ? `✅ رسالة الطرد الحالية (مخصصة):\n${currentCustom}`
        : 'ℹ️ لا توجد رسالة طرد مخصصة حاليًا.';
    return (
      `👢 *kick*\n\n` +
      `*الاستخدام:*\n` +
      `• .kick @user\n` +
      `• .kick (رد على رسالة)\n` +
      `• .kick رقم\n\n` +
      `*تخصيص رسالة الطرد:*\n` +
      `• .kick set <رسالة الطرد>\n` +
      `• .kick off\n\n` +
      `*المتغيرات:*\n` +
      `{user} = الشخص/الأشخاص\n` +
      `{by} = الأدمن المنفّذ\n` +
      `{group} = اسم الجروب\n\n` +
      `*ملحوظة:* لو مفيش رسالة طرد مخصصة، الرسالة الافتراضية:\n` +
      `${defaultTemplate}\n\n` +
      `${current}`
    );
  }

  const current =
    currentCustom
      ? `✅ Current kick message (custom):\n${currentCustom}`
      : 'ℹ️ No custom kick message is set.';
  return (
    `👢 *Kick*\n\n` +
    `*Usage:*\n` +
    `• .kick @user\n` +
    `• .kick (reply to a message)\n` +
    `• .kick number\n\n` +
    `*Customize kick message:*\n` +
    `• .kick set <kick message>\n` +
    `• .kick off\n\n` +
    `*Placeholders:*\n` +
    `{user} = target user(s)\n` +
    `{by} = admin who kicked\n` +
    `{group} = group name\n\n` +
    `*Note:* If no custom kick message is set, default will be used:\n` +
    `${defaultTemplate}\n\n` +
    `${current}`
  );
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      needAdmin: '❌ Please make the bot an admin first.',
      onlyAdmins: '❌ Only group admins can use the kick command.',
      needTarget: '❌ Mention the user or reply to their message to kick!',
      cantKickMe: "🤖 I can't kick myself.",
      fail: '❌ Failed to kick user(s)!',
      setUsage: 'ℹ️ Usage:\n.kick set <message>\nExample:\n.kick set 👢 Kicked: {user}\\n👑 By: {by}',
      setOk: '✅ Kick message saved.',
      offOk: '🗑️ Custom kick message removed.'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      needAdmin: '❌ لازم البوت يبقى أدمن الأول.',
      onlyAdmins: '❌ الأمر ده للأدمنية بس.',
      needTarget: '❌ منشن الشخص أو اعمل ريبلاي على رسالته عشان أطرده.',
      cantKickMe: '🤖 مش هقدر أطرد نفسي.',
      fail: '❌ فشل طرد العضو/الأعضاء!',
      setUsage: 'ℹ️ الاستخدام:\n.kick set <الرسالة>\nمثال:\n.kick set 👢 تم طرد: {user}\\n👑 بواسطة: {by}',
      setOk: '✅ تم حفظ رسالة الطرد.',
      offOk: '🗑️ تم حذف رسالة الطرد المخصصة.'
    }
  };
  return { lang, T: dict[lang] || dict.en };
}

async function kickCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const senderId = message.key.participant || message.key.remoteJid;
  const isOwner = !!message.key.fromMe;
  const { lang, T } = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  const raw = getText(message).trim();
  const used = (raw.split(/\s+/)[0] || 'kick').toLowerCase();
  const rest = raw.slice(used.length).trim();
  const parts = rest ? rest.split(/\s+/) : [];
  const sub = (parts[0] || '').toLowerCase();

  let adminStatus = null;
  try {
    adminStatus = await isAdmin(sock, chatId, senderId);
  } catch {}

  if (adminStatus && !adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '🛡️');
    await sock.sendMessage(chatId, { text: T.needAdmin }, { quoted: message });
    return;
  }

  if (!isOwner) {
    if (!adminStatus?.isBotAdmin) {
      await safeReact(sock, chatId, message.key, '🛡️');
      await sock.sendMessage(chatId, { text: T.needAdmin }, { quoted: message });
      return;
    }

    if (!adminStatus?.isSenderAdmin) {
      await safeReact(sock, chatId, message.key, '🚫');
      await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });
      return;
    }
  }

  const currentCustom = readKickMsg(chatId);
  const defaultTemplate = getDefaultKickTemplate(lang);

  if (!sub) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: helpText(lang, defaultTemplate, currentCustom) }, { quoted: message });
    return;
  }

  if (sub === 'set') {
    const msg = parts.slice(1).join(' ').trim();
    if (!msg) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.setUsage }, { quoted: message });
      return;
    }

    const ok = writeKickMsg(chatId, msg);
    await safeReact(sock, chatId, message.key, ok ? '📝' : '❌');
    await sock.sendMessage(chatId, { text: ok ? T.setOk : T.fail }, { quoted: message });
    return;
  }

  if (sub === 'off') {
    const ok = removeKickMsg(chatId);
    await safeReact(sock, chatId, message.key, ok ? '🗑️' : '❌');
    await sock.sendMessage(chatId, { text: ok ? T.offOk : T.fail }, { quoted: message });
    return;
  }

  const targets = extractTargets(message, args);

  if (!targets.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(
      chatId,
      { text: `${helpText(lang, defaultTemplate, currentCustom)}\n\n${T.needTarget}` },
      { quoted: message }
    );
    return;
  }

  const botId = sock.user?.id || '';
  const botPhone = String(botId).split(':')[0];
  const botJid = botPhone ? `${botPhone}@s.whatsapp.net` : '';
  let filtered = targets.filter(j => j !== botId && j !== botJid && j !== botJid.replace('@s.whatsapp.net', '@lid'));

  if (!filtered.length) {
    await safeReact(sock, chatId, message.key, '🤖');
    await sock.sendMessage(chatId, { text: T.cantKickMe }, { quoted: message });
    return;
  }

  try {
    await safeReact(sock, chatId, message.key, '👢');
    await sock.groupParticipantsUpdate(chatId, filtered, 'remove');

    const text = await buildKickText(sock, chatId, lang, filtered, senderId);
    await safeReact(sock, chatId, message.key, '✅');

    await sock.sendMessage(
      chatId,
      { text, mentions: [...filtered, senderId] },
      { quoted: message }
    );
  } catch (err) {
    console.error('[KICK]', err);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'kick',
  aliases: ['kick', 'طرد', 'remove'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'طرد عضو/أعضاء من الجروب، مع دعم تخصيص رسالة الطرد لكل جروب باستخدام placeholders.',
    en: 'Kicks member(s) from the group, with per-group customizable kick message using placeholders.'
  },
  
  emoji: '👢',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: kickCommand,
  run: kickCommand,
  execute: (sock, message, args) => kickCommand(sock, message, args),
  kickCommand
};