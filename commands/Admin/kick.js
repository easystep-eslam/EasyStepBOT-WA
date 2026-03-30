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
    const v = String(text || '').replace(/\\n/g, '\n').trim();
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

function TXT(chatId) {
  const lang = getLang(chatId);
  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      needAdmin: '❌ Please make the bot an admin first.',
      onlyAdmins: '❌ Only group admins can use the kick command.',
      needTarget: '❌ Mention the user or reply to their message to kick!',
      cantKickMe: "🤖 I can't kick myself.",
      fail: '❌ Failed to kick user(s)!'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      needAdmin: '❌ لازم البوت يبقى أدمن الأول.',
      onlyAdmins: '❌ الأمر ده للأدمنية بس.',
      needTarget: '❌ منشن الشخص أو اعمل ريبلاي على رسالته عشان أطرده.',
      cantKickMe: '🤖 مش هقدر أطرد نفسي.',
      fail: '❌ فشل طرد العضو/الأعضاء!'
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

  // 🔥 KICK ALL
  if (sub === 'all') {
    try {
      await safeReact(sock, chatId, message.key, '⚠️');

      const meta = await sock.groupMetadata(chatId);
      const participants = meta.participants || [];

      const admins = participants.filter(p => p.admin).map(p => p.id);

      let toKick = participants
        .map(p => p.id)
        .filter(j => !admins.includes(j));

      const botId = sock.user?.id || '';
      const botPhone = String(botId).split(':')[0];
      const botJid = botPhone ? `${botPhone}@s.whatsapp.net` : '';

      toKick = toKick.filter(j =>
        j !== botId &&
        j !== botJid &&
        j !== botJid.replace('@s.whatsapp.net', '@lid')
      );

      if (!toKick.length) {
        await safeReact(sock, chatId, message.key, 'ℹ️');
        await sock.sendMessage(chatId, {
          text: lang === 'ar' ? '❌ لا يوجد أعضاء لطردهم.' : '❌ No members to kick.'
        }, { quoted: message });
        return;
      }

      await safeReact(sock, chatId, message.key, '👢');

      const chunkSize = 10;
      for (let i = 0; i < toKick.length; i += chunkSize) {
        const chunk = toKick.slice(i, i + chunkSize);
        await sock.groupParticipantsUpdate(chatId, chunk, 'remove');
      }

      const text = await buildKickText(sock, chatId, lang, toKick, senderId);

      await safeReact(sock, chatId, message.key, '✅');

      await sock.sendMessage(
        chatId,
        { text, mentions: [...toKick, senderId] },
        { quoted: message }
      );

    } catch (err) {
      console.error('[KICK ALL]', err);
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
    }

    return;
  }

  // 👇 الكيك العادي
  const targets = extractTargets(message, args);

  if (!targets.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.needTarget }, { quoted: message });
    return;
  }

  const botId = sock.user?.id || '';
  const botPhone = String(botId).split(':')[0];
  const botJid = botPhone ? `${botPhone}@s.whatsapp.net` : '';
  let filtered = targets.filter(j => j !== botId && j !== botJid);

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
    ar: 'طرد عضو أو كل الأعضاء ماعدا الأدمنز.',
    en: 'Kick member(s) or all members except admins.'
  },
  emoji: '👢',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: kickCommand
};
