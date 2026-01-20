const fs = require('fs');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

function readJsonSafe(filePath, fallback) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(txt || '{}');
  } catch {
    return fallback;
  }
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TT(chatId) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      ownerOnly: '❌ This command is only available for the owner!',
      failed: '❌ Failed to read settings.',
      noteGroup: 'Note: Per-group settings will be shown when used inside a group.',
      mode: 'Mode',
      public: 'Public',
      private: 'Private',
      autoStatus: 'Auto Status',
      autoread: 'Autoread',
      autotyping: 'Autotyping',
      pmblocker: 'PM Blocker',
      anticall: 'Anticall',
      autoReaction: 'Auto Reaction',
      group: 'Group',
      antilink: 'Antilink',
      antibadword: 'Antibadword',
      welcome: 'Welcome',
      goodbye: 'Goodbye',
      chatbot: 'Chatbot',
      antitag: 'Antitag',
      on: 'ON',
      off: 'OFF',
      action: 'action',
      delete: 'delete'
    },
    ar: {
      ownerOnly: '❌ الأمر ده للمالك فقط!',
      failed: '❌ فشل في قراءة الإعدادات.',
      noteGroup: 'ملاحظة: إعدادات الجروب بتظهر لما تستخدم الأمر داخل جروب.',
      mode: 'الوضع',
      public: 'عام',
      private: 'خاص',
      autoStatus: 'مشاهدة الاستاتس',
      autoread: 'قراءة تلقائية',
      autotyping: 'كتابة وهمية',
      pmblocker: 'حظر الخاص',
      anticall: 'مانع المكالمات',
      autoReaction: 'تفاعل تلقائي',
      group: 'الجروب',
      antilink: 'مانع الروابط',
      antibadword: 'مانع الألفاظ',
      welcome: 'ترحيب',
      goodbye: 'وداع',
      chatbot: 'شات بوت',
      antitag: 'مانع المنشن',
      on: 'تشغيل',
      off: 'إيقاف',
      action: 'الإجراء',
      delete: 'حذف'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

async function settingsCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const { T } = TT(chatId);

  await safeReact(sock, chatId, message.key, '⚙️');

  try {
    const senderId = message.key.participant || message.key.remoteJid;
    const owner = message.key.fromMe || (await isOwnerOrSudo(senderId, sock, chatId));

    if (!owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    const isGroup = chatId.endsWith('@g.us');
    const dataDir = './data';

    const mode = readJsonSafe(`${dataDir}/messageCount.json`, { isPublic: true });
    const autoStatus = readJsonSafe(`${dataDir}/autoStatus.json`, { enabled: false, reactOn: false });
    const autoread = readJsonSafe(`${dataDir}/autoread.json`, { enabled: false });
    const autotyping = readJsonSafe(`${dataDir}/autotyping.json`, { enabled: false });
    const pmblocker = readJsonSafe(`${dataDir}/pmblocker.json`, { enabled: false });
    const anticall = readJsonSafe(`${dataDir}/anticall.json`, { enabled: false });

    const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
      antilink: {},
      antibadword: {},
      welcome: {},
      goodbye: {},
      chatbot: {},
      antitag: {},
      autoReaction: false
    });

    const autoReaction = Boolean(userGroupData.autoReaction);

    const groupId = isGroup ? chatId : null;

    const antilinkOn = groupId ? Boolean(userGroupData.antilink && userGroupData.antilink[groupId]) : false;
    const antibadwordOn = groupId ? Boolean(userGroupData.antibadword && userGroupData.antibadword[groupId]) : false;
    const welcomeOn = groupId ? Boolean(userGroupData.welcome && userGroupData.welcome[groupId]) : false;
    const goodbyeOn = groupId ? Boolean(userGroupData.goodbye && userGroupData.goodbye[groupId]) : false;
    const chatbotOn = groupId ? Boolean(userGroupData.chatbot && userGroupData.chatbot[groupId]) : false;
    const antitagCfg = groupId ? (userGroupData.antitag && userGroupData.antitag[groupId]) : null;

    const statusView = autoStatus.enabled ? T.on : T.off;
    const statusReact = autoStatus.reactOn ? T.on : T.off;

    const lines = [];

    lines.push(`┏━━〔 ⚙️ EasyStep-BOT 〕━━┓`);
    lines.push(`┃ ${T.mode}        : ${mode.isPublic ? T.public : T.private}`);
    lines.push(`┃ ${T.autoStatus}   : ${statusView} (${statusReact})`);
    lines.push(`┃ ${T.autoread}     : ${autoread.enabled ? T.on : T.off}`);
    lines.push(`┃ ${T.autotyping}   : ${autotyping.enabled ? T.on : T.off}`);
    lines.push(`┃ ${T.pmblocker}    : ${pmblocker.enabled ? T.on : T.off}`);
    lines.push(`┃ ${T.anticall}     : ${anticall.enabled ? T.on : T.off}`);
    lines.push(`┃ ${T.autoReaction} : ${autoReaction ? T.on : T.off}`);
    lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━┛`);

    if (groupId) {
      lines.push('');
      lines.push(`┏━━〔 👥 ${T.group} 〕━━┓`);
      lines.push(`┃ ID: ${groupId}`);

      if (antilinkOn) {
        const al = userGroupData.antilink[groupId] || {};
        lines.push(`┃ ${T.antilink} : ${T.on} (${T.action}: ${al.action || T.delete})`);
      } else {
        lines.push(`┃ ${T.antilink} : ${T.off}`);
      }

      if (antibadwordOn) {
        const ab = userGroupData.antibadword[groupId] || {};
        lines.push(`┃ ${T.antibadword} : ${T.on} (${T.action}: ${ab.action || T.delete})`);
      } else {
        lines.push(`┃ ${T.antibadword} : ${T.off}`);
      }

      lines.push(`┃ ${T.welcome}   : ${welcomeOn ? T.on : T.off}`);
      lines.push(`┃ ${T.goodbye}   : ${goodbyeOn ? T.on : T.off}`);
      lines.push(`┃ ${T.chatbot}   : ${chatbotOn ? T.on : T.off}`);

      if (antitagCfg && antitagCfg.enabled) {
        lines.push(`┃ ${T.antitag}  : ${T.on} (${T.action}: ${antitagCfg.action || T.delete})`);
      } else {
        lines.push(`┃ ${T.antitag}  : ${T.off}`);
      }

      lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━┛`);
    } else {
      lines.push('');
      lines.push(T.noteGroup);
    }

    await safeReact(sock, chatId, message.key, '✅');
    return await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
  } catch (error) {
    console.error('[SETTINGS]', error?.stack || error);
    await safeReact(sock, chatId, message?.key, '❌');
    return await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'settings',
  aliases: ['sett', 'اعدادات', 'ضبط', 'settingsbot'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'عرض إعدادات البوت العامة وإعدادات الجروب عند استخدام الأمر داخل جروب.',
    en: 'Show the bot global settings and group settings when used inside a group.'
  },
  usage: {
    ar: 'settings',
    en: 'settings'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '⚙️',
  exec: settingsCommand,
  run: settingsCommand,
  execute: settingsCommand,

  settingsCommand
};
