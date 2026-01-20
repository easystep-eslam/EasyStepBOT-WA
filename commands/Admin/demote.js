const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

function tr(chatId) {
  const lang = getLang(chatId);
  const dict = {
    onlyGroups: {
      en: 'This command can only be used in groups!',
      ar: 'الأمر ده بيشتغل في الجروبات بس!'
    },
    botNeedAdmin: {
      en: '❌ Please make the bot an admin first to use this command.',
      ar: '❌ لازم تخلي البوت أدمن الأول علشان تستخدم الأمر ده.'
    },
    senderNeedAdmin: {
      en: '❌ Only group admins can use the demote command.',
      ar: '❌ الأمر ده للأدمن بس.'
    },
    adminCheckFail: {
      en: '❌ Please make sure the bot is an admin of this group.',
      ar: '❌ تأكد إن البوت أدمن في الجروب.'
    },
    noUser: {
      en: '❌ Please mention the user or reply to their message to demote!',
      ar: '❌ منشن الشخص أو اعمل رد على رسالته علشان تسحب منه الأدمن!'
    },
    cantDemoteBot: {
      en: '❌ You cannot demote the bot.',
      ar: '❌ مينفعش تسحب أدمن من البوت.'
    },
    notAdminTarget: {
      en: 'ℹ️ Target user is not an admin.',
      ar: 'ℹ️ الشخص ده مش أدمن أصلاً.'
    },
    rateLimit: {
      en: '❌ Rate limit reached. Please try again in a few seconds.',
      ar: '❌ حصل Rate limit. جرّب تاني بعد كام ثانية.'
    },
    failed: {
      en: '❌ Failed to demote user(s). Make sure the bot is admin and has sufficient permissions.',
      ar: '❌ فشل سحب الأدمن. تأكد إن البوت أدمن وعنده صلاحيات كفاية.'
    },
    header: {
      en: '『 GROUP DEMOTION 』',
      ar: '『 سحب أدمن 』'
    },
    demotedUsers: {
      en: 'Demoted User',
      ar: 'تم سحب الأدمن من'
    },
    demotedBy: {
      en: 'Demoted By',
      ar: 'بواسطة'
    },
    date: {
      en: 'Date',
      ar: 'التاريخ'
    }
  };
  return { lang, dict };
}

function getMentions(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  return Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
}

function getRepliedParticipant(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  return ctx.participant || null;
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function formatNow(lang) {
  try {
    return new Date().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
  } catch {
    return String(new Date());
  }
}

async function demoteCore(sock, chatId, message) {
  const { lang, dict } = tr(chatId);

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: dict.onlyGroups[lang] || dict.onlyGroups.en }, { quoted: message });
    return;
  }

  const senderId = message.key.participant || message.key.remoteJid;

  let adminStatus;
  try {
    adminStatus = await isAdmin(sock, chatId, senderId);
  } catch (e) {
    console.error('demote admin check:', e);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: dict.adminCheckFail[lang] || dict.adminCheckFail.en }, { quoted: message });
    return;
  }

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '🛡️');
    await sock.sendMessage(chatId, { text: dict.botNeedAdmin[lang] || dict.botNeedAdmin.en }, { quoted: message });
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: dict.senderNeedAdmin[lang] || dict.senderNeedAdmin.en }, { quoted: message });
    return;
  }

  let targets = [];
  const mentioned = getMentions(message);
  const replied = getRepliedParticipant(message);

  if (mentioned.length) targets = mentioned;
  else if (replied) targets = [replied];

  if (!targets.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: dict.noUser[lang] || dict.noUser.en }, { quoted: message });
    return;
  }

  try {
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    targets = targets.filter((j) => j !== botJid && j !== botJid.replace('@s.whatsapp.net', '@lid'));
    if (!targets.length) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: dict.cantDemoteBot[lang] || dict.cantDemoteBot.en }, { quoted: message });
      return;
    }
  } catch {}

  try {
    const meta = await sock.groupMetadata(chatId);
    const adminsSet = new Set(
      (meta.participants || [])
        .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
        .map((p) => p.id)
    );

    const onlyAdmins = targets.filter((j) => adminsSet.has(j));
    if (!onlyAdmins.length) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: dict.notAdminTarget[lang] || dict.notAdminTarget.en }, { quoted: message });
      return;
    }
    targets = onlyAdmins;
  } catch {}

  await safeReact(sock, chatId, message.key, '⬇️');

  try {
    await new Promise((r) => setTimeout(r, 800));
    await sock.groupParticipantsUpdate(chatId, targets, 'demote');
    await new Promise((r) => setTimeout(r, 800));

    const actorTag = `@${senderId.split('@')[0]}`;
    const usernames = targets.map((jid) => `@${jid.split('@')[0]}`);

    const msg =
      `*${dict.header[lang] || dict.header.en}*\n\n` +
      `👤 *${(dict.demotedUsers[lang] || dict.demotedUsers.en)}${targets.length > 1 ? (lang === 'ar' ? '' : 's') : ''}:*\n` +
      `${usernames.map((n) => `• ${n}`).join('\n')}\n\n` +
      `👑 *${dict.demotedBy[lang] || dict.demotedBy.en}:* ${actorTag}\n\n` +
      `📅 *${dict.date[lang] || dict.date.en}:* ${formatNow(lang)}`;

    await sock.sendMessage(chatId, { text: msg, mentions: [...targets, senderId] }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✅');
  } catch (error) {
    console.error('demote error:', error);

    if (error?.data === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      await safeReact(sock, chatId, message.key, '⏳');
      await sock.sendMessage(chatId, { text: dict.rateLimit[lang] || dict.rateLimit.en }, { quoted: message }).catch(() => {});
      return;
    }

    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: dict.failed[lang] || dict.failed.en }, { quoted: message }).catch(() => {});
  }
}

async function handleDemotionEvent(sock, groupId, participants, author) {
  try {
    if (!Array.isArray(participants) || participants.length === 0) return;

    const { lang, dict } = tr(groupId);

    const mentionList = participants
      .map((j) => (typeof j === 'string' ? j : (j?.id || j?.toString?.() || '')))
      .filter(Boolean);

    const demotedUsernames = mentionList.map((j) => `@${j.split('@')[0]}`);

    let demotedBy = lang === 'ar' ? 'النظام' : 'System';
    if (author) {
      const authorJid = typeof author === 'string' ? author : (author?.id || author?.toString?.() || '');
      if (authorJid) {
        demotedBy = `@${authorJid.split('@')[0]}`;
        mentionList.push(authorJid);
      }
    }

    const msg =
      `*${dict.header[lang] || dict.header.en}*\n\n` +
      `👤 *${(dict.demotedUsers[lang] || dict.demotedUsers.en)}${participants.length > 1 ? (lang === 'ar' ? '' : 's') : ''}:*\n` +
      `${demotedUsernames.map((n) => `• ${n}`).join('\n')}\n\n` +
      `👑 *${dict.demotedBy[lang] || dict.demotedBy.en}:* ${demotedBy}\n\n` +
      `📅 *${dict.date[lang] || dict.date.en}:* ${formatNow(lang)}`;

    await sock.sendMessage(groupId, { text: msg, mentions: mentionList });
  } catch (e) {
    console.error('demotion event error:', e);
    if (e?.data === 429) await new Promise((r) => setTimeout(r, 2000));
  }
}

async function demoteCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;
  await demoteCore(sock, chatId, message);
}

module.exports = {
  name: 'demote',
  aliases: ['demote', 'سحب_ادمن', 'تنزيل_ادمن', 'dem'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'يسحب صلاحية الأدمن من عضو/أعضاء في الجروب (منشن أو رد على رسالة) مع توثيق من نفّذ العملية.',
    en: 'Demotes one or more admins in the group (mention or reply) and logs who performed the action.'
  },
  emoji: '🧑‍💼⬇️',

  admin: true,
  owner: false,
  showInMenu: true,
  run: demoteCommand,
  exec: demoteCommand,
  execute: (sock, message, args) => demoteCommand(sock, message, args),
  demoteCommand,
  handleDemotionEvent
};