const fs = require('fs');
const path = require('path');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const dataFilePath = path.join(process.cwd(), 'data', 'messageCount.json');

function ensureDataDir() {
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadMessageCounts() {
  try {
    ensureDataDir();
    if (!fs.existsSync(dataFilePath)) return {};
    const raw = fs.readFileSync(dataFilePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveMessageCounts(messageCounts) {
  try {
    ensureDataDir();
    fs.writeFileSync(dataFilePath, JSON.stringify(messageCounts, null, 2));
    return true;
  } catch {
    return false;
  }
}

function incrementMessageCount(groupId, userId) {
  if (!groupId || !userId) return;
  if (!String(groupId).endsWith('@g.us')) return;

  const messageCounts = loadMessageCounts();

  if (!messageCounts[groupId]) messageCounts[groupId] = {};
  if (!messageCounts[groupId][userId]) messageCounts[groupId][userId] = 0;

  messageCounts[groupId][userId] += 1;
  saveMessageCounts(messageCounts);
}

function isArabicText(s) {
  return /[\u0600-\u06FF]/.test(String(s || ''));
}

function smallestAlias(list) {
  const arr = Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  if (!arr.length) return null;
  return arr.slice().sort((a, b) => a.localeCompare(b, 'en'))[0];
}

function pickAliases(command) {
  const aliases = Array.isArray(command?.aliases) ? command.aliases.map(String) : [];
  const ar = aliases.filter(isArabicText);
  const en = aliases.filter(a => !isArabicText(a));
  const arMin = smallestAlias(ar);
  const enMin = smallestAlias(en);
  return { arMin, enMin, aliases };
}

function T(chatId) {
  const lang = getLang(chatId);
  return {
    lang,
    TXT: {
      en: {
        groupOnly: '❌ This command works in groups only.',
        botAdmin: '❌ Please make the bot an admin first.',
        adminOnly: '❌ Only group admins can use this command.',
        noData: 'ℹ️ No message activity recorded yet.',
        title: '🏆 Top Members by Messages:',
        msg: 'messages',
        me: 'you'
      },
      ar: {
        groupOnly: '❌ الأمر ده متاح في الجروبات بس.',
        botAdmin: '❌ لازم تخلي البوت أدمن الأول.',
        adminOnly: '❌ الأمر ده للأدمنية بس.',
        noData: 'ℹ️ مفيش نشاط رسائل متسجل لسه.',
        title: '🏆 أكثر الأعضاء تفاعلًا حسب عدد الرسائل:',
        msg: 'رسالة',
        me: 'أنت'
      }
    }
  };
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function topMembersCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const { lang, TXT } = T(chatId);
  const tt = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '🏆');

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: tt.groupOnly }, { quoted: message });
    return;
  }

  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: tt.botAdmin }, { quoted: message });
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: tt.adminOnly }, { quoted: message });
    return;
  }

  const messageCounts = loadMessageCounts();
  const groupCounts = messageCounts[chatId] || {};

  const sortedMembers = Object.entries(groupCounts)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 5);

  if (!sortedMembers.length) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: tt.noData }, { quoted: message });
    return;
  }

  let text = `*${tt.title}*\n\n`;
  const mentions = [];

  sortedMembers.forEach(([userId, count], index) => {
    const num = String(userId).split('@')[0];
    const isMe = String(userId) === String(senderId);

    mentions.push(userId);

    text +=
      `${index + 1}. @${num}` +
      (isMe ? ` (${tt.me})` : '') +
      ` - ${count} ${tt.msg}\n`;
  });

  await sock.sendMessage(chatId, { text: text.trim(), mentions }, { quoted: message });
  await safeReact(sock, chatId, message.key, '✅');
}

module.exports = {
  name: 'topmembers',

  aliases: [
    'topmembers',
    'top',
    'topmsg',
    'messages',
    'توب',
    'توب_اعضاء',
    'الاكثر',
    'الأكثر',
    'نشاط',
    'تفاعل',
    'توب_رسائل'
  ],

  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },

  description: {
    ar: 'عرض أكثر 5 أعضاء تفاعلًا في الجروب حسب عدد الرسائل المسجلة.',
    en: 'Show the top 5 most active members in the group based on recorded message count.'
  },

  usage: {
    ar: 'يعرض قائمة أفضل 5 أعضاء تفاعلًا.',
    en: 'Shows the top 5 most active members.'
  },

  emoji: '🏆',

  admin: true,
  owner: false,
  showInMenu: true,

  run: topMembersCommand,
  exec: topMembersCommand,
  execute: (sock, message, args) => topMembersCommand(sock, message, args),

  incrementMessageCount
};