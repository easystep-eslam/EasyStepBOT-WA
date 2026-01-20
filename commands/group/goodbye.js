const { handleGoodbye } = require('../../lib/welcome');
const { isGoodByeOn, getGoodbye } = require('../../lib/index');
const isAdmin = require('../../lib/isAdmin');
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
      groupOnly: '❌ This command can only be used in groups.',
      adminOnly: '❌ Only group admins can use this command.',
      botAdminNeed: '❌ Please make the bot an admin first.',
      error: '❌ Error while processing goodbye command.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات فقط.',
      adminOnly: '❌ الأمر ده لمشرفين الجروب فقط.',
      botAdminNeed: '❌ لازم تخلي البوت أدمن الأول.',
      error: '❌ حصل خطأ أثناء تنفيذ أمر الوداع.'
    }
  };

  return { lang, T: dict[lang] || dict.en };
}

async function goodbyeCommand(sock, chatId, message, args = [], senderId, isSenderAdmin) {
  const { T } = TXT(chatId);

  await safeReact(sock, chatId, message.key, '👋');

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
  const senderIsAdmin =
    typeof isSenderAdmin === 'boolean' ? isSenderAdmin : !!adminStatus?.isSenderAdmin;

  if (!botIsAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botAdminNeed }, { quoted: message });
    return;
  }

  if (!senderIsAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    return;
  }

  try {
    const raw = getText(message).trim();
    const used = (raw.split(/\s+/)[0] || 'goodbye').toLowerCase();
    const rest = raw.slice(used.length).trim();
    const fromArgs = Array.isArray(args) && args.length ? args.join(' ').trim() : '';
    const matchText = (fromArgs || rest || '').trim();

    await handleGoodbye(sock, chatId, message, matchText);

    await safeReact(sock, chatId, message.key, '✅');
  } catch (e) {
    console.error('[GOODBYE]', e);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

async function handleLeaveEvent(sock, id, participants) {
  try {
    const isGoodbyeEnabled = await isGoodByeOn(id);
    if (!isGoodbyeEnabled) return;

    const customMessage = await getGoodbye(id);
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata?.subject || '';

    for (const participant of participants || []) {
      const participantJid = typeof participant === 'string' ? participant : participant?.id;
      if (!participantJid) continue;

      const userNumber = participantJid.split('@')[0];

      const fallback =
        getLang(id) === 'ar'
          ? `*@${userNumber}* وداعًا 👋`
          : `*@${userNumber}* goodbye 👋`;

      const template = customMessage ? String(customMessage) : fallback;

      const finalMessage = template
        .replace(/{user}/g, `@${userNumber}`)
        .replace(/{group}/g, groupName);

      await sock.sendMessage(id, {
        text: finalMessage,
        mentions: [participantJid]
      });
    }
  } catch (e) {
    console.error('Goodbye send error:', e);
  }
}

/* metadata last */
module.exports = {
  name: 'goodbye',
  aliases: ['goodbye', 'وداع', 'وداع_الجروب', 'خروج'],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'تشغيل/إيقاف أو تخصيص رسالة الوداع عند خروج عضو من الجروب.',
    en: 'Enable/disable or customize the goodbye message when a member leaves the group.'
  },

  usage: {
    ar: '.goodbye on | off | set <message> | get',
    en: '.goodbye on | off | set <message> | get'
  },

  emoji: '👋',

  admin: true,
  owner: false,
  showInMenu: true,

  run: (sock, chatId, message, args, senderId, isSenderAdmin) =>
    goodbyeCommand(sock, chatId, message, args, senderId, isSenderAdmin),

  exec: (sock, message, args, senderId, isSenderAdmin) =>
    goodbyeCommand(sock, message.key.remoteJid, message, args, senderId, isSenderAdmin),

  execute: (sock, message, args) =>
    goodbyeCommand(sock, message.key.remoteJid, message, args),

  goodbyeCommand,
  handleLeaveEvent
};