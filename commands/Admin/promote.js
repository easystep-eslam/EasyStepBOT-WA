const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const PENDING_FILE = path.join(process.cwd(), 'data', 'pending_promote.json');

function ensureFile() {
  const dir = path.dirname(PENDING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PENDING_FILE)) fs.writeFileSync(PENDING_FILE, JSON.stringify({}, null, 2));
}

function readPending() {
  try {
    ensureFile();
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8') || '{}') || {};
  } catch {
    return {};
  }
}

function writePending(data) {
  try {
    ensureFile();
    fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function addPending(groupId, jid) {
  const data = readPending();
  if (!data[groupId]) data[groupId] = [];
  const arr = Array.isArray(data[groupId]) ? data[groupId] : [];
  if (!arr.includes(jid)) arr.push(jid);
  data[groupId] = arr;
  return writePending(data);
}

function removePending(groupId, jid) {
  const data = readPending();
  const arr = Array.isArray(data[groupId]) ? data[groupId] : [];
  data[groupId] = arr.filter(x => x !== jid);
  if (!data[groupId].length) delete data[groupId];
  return writePending(data);
}

function extractNumber(str = '') {
  return String(str).replace(/[^0-9]/g, '');
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

function asJidString(jid) {
  return typeof jid === 'string' ? jid : (jid?.id || jid?.toString?.() || '');
}

function jidToMention(jid) {
  const s = asJidString(jid);
  return s ? `@${s.split('@')[0]}` : '@unknown';
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);
  const ar = lang === 'ar';

  const t = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botNeedAdmin: '❌ Please make the bot an admin first.',
      adminOnly: '❌ Only group admins can use this command.',
      help:
        '*PROMOTE*\n\n' +
        '• .promote @user\n' +
        '• .promote (reply)\n' +
        '• .promote <number>\n\n' +
        'If the number is not in the group:\n' +
        '- Bot will try to add it\n' +
        '- If privacy is enabled, bot will send invite + auto-promote after join',
      badNumber: '❌ Invalid number.\nExample:\n.promote 201234567890',
      noTarget: '❌ Mention a user, reply to a message, or write a number.',
      added: (n) => `➕ Added @${n}. Promoting...`,
      invited: (n) => `🔗 @${n} has privacy enabled. Invite sent.\n⏳ Will auto-promote after join.`,
      promoted: (list) => `👑 Promoted:\n${list}`,
      fail: '❌ Failed. Make sure the bot is admin and has enough permissions.'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      botNeedAdmin: '❌ لازم البوت يبقى أدمن الأول.',
      adminOnly: '❌ الأمر ده للأدمنية بس.',
      help:
        '*ترقية مشرف (PROMOTE)*\n\n' +
        '• .promote @user\n' +
        '• .promote (رد على رسالة)\n' +
        '• .promote رقم\n\n' +
        'لو الرقم مش موجود في الجروب:\n' +
        '- البوت هيحاول يضيفه\n' +
        '- لو قافل الخصوصية هيرسل دعوة + هيترفع تلقائي أول ما يدخل',
      badNumber: '❌ رقم غير صحيح.\nمثال:\n.promote 201234567890',
      noTarget: '❌ منشن/ريبلاي/رقم مطلوب.',
      added: (n) => `➕ تمت إضافة @${n}.. جاري الترقية`,
      invited: (n) => `🔗 @${n} قافل الخصوصية. تم إرسال دعوة.\n⏳ هيترفع تلقائي أول ما يدخل.`,
      promoted: (list) => `👑 تم الترقية:\n${list}`,
      fail: '❌ فشل التنفيذ. تأكد إن البوت أدمن وصلاحياته كاملة.'
    }
  };

  return { lang, T: (ar ? t.ar : t.en) };
}

function extractTargets(message, args) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  const replied = ctx.participant ? [ctx.participant] : [];

  let targets = [...mentioned, ...replied].filter(Boolean);

  if (!targets.length) {
    const rawArgs = Array.isArray(args) && args.length ? args.join(' ') : '';
    const fromArgs = extractNumber(rawArgs);
    if (fromArgs && fromArgs.length >= 10) targets = [`${fromArgs}@s.whatsapp.net`];
    else {
      const raw = getText(message).trim();
      const parts = raw.split(/\s+/);
      const maybe = extractNumber(parts.slice(1).join(' '));
      if (maybe && maybe.length >= 10) targets = [`${maybe}@s.whatsapp.net`];
    }
  }

  return [...new Set(targets)];
}

async function promoteCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const senderId = message.key.participant || chatId;
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message.key, '👑');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);
  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botNeedAdmin }, { quoted: message });
    return;
  }
  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    return;
  }

  const targets = extractTargets(message, args);
  if (!targets.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
    return;
  }

  const numeric = targets.length === 1 ? extractNumber(targets[0].split('@')[0]) : '';
  if (targets.length === 1 && numeric && numeric.length < 10) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.badNumber }, { quoted: message });
    return;
  }

  let meta = null;
  try { meta = await sock.groupMetadata(chatId); } catch {}
  const participants = Array.isArray(meta?.participants) ? meta.participants : [];
  const inGroup = new Set(participants.map(p => p.id).filter(Boolean));

  const needAdd = targets.filter(j => !inGroup.has(j));
  const alreadyInside = targets.filter(j => inGroup.has(j));

  const promotedNow = [];

  if (alreadyInside.length) {
    try {
      await sock.groupParticipantsUpdate(chatId, alreadyInside, 'promote');
      promotedNow.push(...alreadyInside);
    } catch {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
      return;
    }
  }

  for (const jid of needAdd) {
    const n = extractNumber(jid.split('@')[0]);
    await safeReact(sock, chatId, message.key, '➕');

    const res = await sock.groupParticipantsUpdate(chatId, [jid], 'add').catch(() => null);
    const status = res?.[0]?.status || res?.status || null;
    const inviteLike = status === 403 || status === '403';

    if (inviteLike) {
      addPending(chatId, jid);
      await safeReact(sock, chatId, message.key, '🔗');
      try {
        const code = await sock.groupInviteCode(chatId);
        const invite = `https://chat.whatsapp.com/${code}`;
        await sock.sendMessage(
          chatId,
          { text: `${T.invited(n)}\n${invite}`, mentions: [jid] },
          { quoted: message }
        );
      } catch {
        await sock.sendMessage(
          chatId,
          { text: T.invited(n), mentions: [jid] },
          { quoted: message }
        );
      }
      continue;
    }

    await safeReact(sock, chatId, message.key, '👑');
    await sock.sendMessage(chatId, { text: T.added(n), mentions: [jid] }, { quoted: message }).catch(() => {});

    try {
      await sock.groupParticipantsUpdate(chatId, [jid], 'promote');
      promotedNow.push(jid);
    } catch {
      addPending(chatId, jid);
      await safeReact(sock, chatId, message.key, '⏳');
    }
  }

  if (promotedNow.length) {
    const lines = promotedNow.map(j => `• ${jidToMention(j)}`).join('\n');
    await safeReact(sock, chatId, message.key, '✅');
    await sock.sendMessage(chatId, { text: T.promoted(lines), mentions: [...new Set([...promotedNow, senderId])] }, { quoted: message });
    return;
  }

  await safeReact(sock, chatId, message.key, '⏳');
}

module.exports = {
  name: 'promote',
  aliases: ['promote', 'ترقية', 'رفع', 'رفع_ادمن'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'ترقية عضو لمشرف عبر منشن/ريبلاي/رقم. لو مش موجود: يضيفه، ولو قافل الخصوصية: يرسل دعوة ويترفع تلقائيًا بعد الانضمام.',
    en: 'Promote member via mention/reply/number. If not in group: tries to add; if privacy blocks: sends invite and auto-promotes after join.'
  },
  usage: {
    ar: '.promote @user | (reply) | رقم',
    en: '.promote @user | (reply) | number'
  },
  
  emoji: '🧑‍💼🔝',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: promoteCommand,
  run: promoteCommand,
  execute: (sock, message, args) => promoteCommand(sock, message, args),
  promoteCommand
};