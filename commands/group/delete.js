const isAdmin = require('../../lib/isAdmin');
const store = require('../../lib/lightweight_store');
const { getLang } = require('../../lib/lang');

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);

  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botNeedAdmin: '❌ Please make the bot an admin first.',
      onlyAdmins: '❌ Only group admins can use this command.',
      usage:
        '*DELETE MESSAGES*\n\n' +
        '• `.del 5` → Delete last 5 messages from the group\n' +
        '• `.del 3 @user` → Delete last 3 messages from that user\n' +
        '• `.del 2` (reply) → Delete last 2 messages from replied user\n\n' +
        'Note: Max = 50 messages.',
      noGroupMessages: 'ℹ️ No recent messages found in the group.',
      noUserMessages: 'ℹ️ No recent messages found for this user.',
      done: (n) => `✅ Deleted ${n} message(s).`,
      failed: '❌ Failed to delete messages.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botNeedAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      onlyAdmins: '❌ الأمر ده لمشرفين الجروب فقط.',
      usage:
        '*مسح الرسائل*\n\n' +
        '• `.del 5` → مسح آخر 5 رسائل من الجروب\n' +
        '• `.del 3 @user` → مسح آخر 3 رسائل من الشخص\n' +
        '• `.del 2` (رد) → مسح آخر رسالتين لصاحب الرسالة\n\n' +
        'ملحوظة: الحد الأقصى = 50 رسالة.',
      noGroupMessages: 'ℹ️ مفيش رسائل قريبة في الجروب.',
      noUserMessages: 'ℹ️ مفيش رسائل قريبة للشخص ده.',
      done: (n) => `✅ تم مسح ${n} رسالة.`,
      failed: '❌ فشل مسح الرسائل.'
    }
  };

  return { lang, T: dict[lang] || dict.en };
}

function extractTarget(message, args) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  const replied = ctx.participant || null;

  let targetUser = replied || (mentioned[0] || null);

  if (!targetUser && Array.isArray(args) && args.length) {
    const maybe = String(args[0] || '').replace(/[^\d]/g, '');
    if (maybe.length >= 8) targetUser = `${maybe}@s.whatsapp.net`;
  }

  return targetUser;
}

function parseCount(args, fallbackText) {
  let n = null;

  if (Array.isArray(args) && args.length) {
    const first = String(args[0] || '').trim();
    if (/^\d+$/.test(first)) n = Number(first);
  }

  if (n === null && fallbackText) {
    const parts = String(fallbackText).trim().split(/\s+/);
    const maybe = parts[1];
    if (/^\d+$/.test(maybe)) n = Number(maybe);
  }

  if (!Number.isFinite(n) || n <= 0) n = 1;
  n = Math.min(Math.floor(n), 50);
  return n;
}

async function deleteCommand(sock, chatId, message, args = [], senderId, isSenderAdmin) {
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message.key, '🧹');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  const sender = senderId || message.key.participant || message.key.remoteJid;

  let adminStatus = null;
  try {
    adminStatus = await isAdmin(sock, chatId, sender);
  } catch {}

  const botIsAdmin = !!adminStatus?.isBotAdmin;
  const senderIsAdmin = typeof isSenderAdmin === 'boolean' ? isSenderAdmin : !!adminStatus?.isSenderAdmin;

  if (!botIsAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botNeedAdmin }, { quoted: message });
    return;
  }

  if (!senderIsAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });
    return;
  }

  const rawText = getText(message);
  const count = parseCount(args, rawText);

  const targetUser = extractTarget(message, Array.isArray(args) ? args.slice(1) : []);
  const deleteGroupMessages = !targetUser;

  const chatMessages = Array.isArray(store?.messages?.[chatId]) ? store.messages[chatId] : [];
  const toDelete = [];

  for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < count; i--) {
    const m = chatMessages[i];
    if (!m?.key?.id) continue;

    const senderJid = m.key.participant || m.key.remoteJid;

    if (m.key.id === message.key.id) continue;
    if (m.message?.protocolMessage) continue;

    if (deleteGroupMessages || senderJid === targetUser) {
      toDelete.push(m);
    }
  }

  if (!toDelete.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(
      chatId,
      { text: deleteGroupMessages ? T.noGroupMessages : T.noUserMessages },
      { quoted: message }
    );
    return;
  }

  let deleted = 0;

  for (const m of toDelete) {
    try {
      await sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          fromMe: false,
          id: m.key.id,
          participant: m.key.participant || m.key.remoteJid
        }
      });
      deleted += 1;
      await new Promise((r) => setTimeout(r, 250));
    } catch {}
  }

  await safeReact(sock, chatId, message.key, deleted ? '✅' : '❌');

  if (deleted) {
    await sock.sendMessage(chatId, { text: T.done(deleted) }, { quoted: message });
    return;
  }

  await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
}

module.exports = {
  name: 'delete',

  aliases: ['del', 'delete', 'مسح', 'حذف'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'مسح آخر رسائل من الجروب أو من عضو محدد (بالمنشن/الرد).',
    en: 'Deletes recent messages from the group or a specific member (mention/reply).'
  },

  usage: {
    ar: '.del 5 | .del 3 @user | .del 2 (رد)',
    en: '.del 5 | .del 3 @user | .del 2 (reply)'
  },

  emoji: '🧹',

  admin: true,
  owner: false,
  showInMenu: true,

  exec: (sock, message, args, senderId, isSenderAdmin) =>
    deleteCommand(sock, message.key.remoteJid, message, args, senderId, isSenderAdmin),

  run: (sock, chatId, message, args, senderId, isSenderAdmin) =>
    deleteCommand(sock, chatId, message, args, senderId, isSenderAdmin),

  execute: (sock, message, args) =>
    deleteCommand(sock, message.key.remoteJid, message, args),

  deleteCommand
};