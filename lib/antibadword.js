const {
  setAntiBadword,
  getAntiBadword,
  removeAntiBadword
} = require('../lib/index');

const fs = require('fs');
const path = require('path');
const { getLang } = require('../lib/lang');

function loadAntibadwordConfig(groupId) {
  try {
    const configPath = path.join(process.cwd(), 'data', 'userGroupData.json');
    if (!fs.existsSync(configPath)) return {};
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8') || '{}');
    return data?.antibadword?.[groupId] || {};
  } catch (e) {
    console.error('Error loading antibadword config:', e);
    return {};
  }
}

async function handleAntiBadwordCommand(sock, chatId, message, match) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      help:
        `🛡️ *Easystep BOT – Anti Badword*\n` +
        `━━━━━━━━━━━━━━\n\n` +
        `• *.antibadword on*\nEnable protection\n\n` +
        `• *.antibadword set delete*\nDelete the message\n\n` +
        `• *.antibadword set warn*\nWarn the member\n\n` +
        `• *.antibadword set kick*\nRemove the member\n\n` +
        `• *.antibadword off*\nDisable protection\n`,
      alreadyOn: '🟢 Protection is already enabled.',
      enabled:
        '✅ Anti-badword enabled.\nYou can choose an action using:\n.antibadword set delete | warn | kick',
      alreadyOff: '🔴 Protection is already disabled.',
      disabled: '❌ Anti-badword has been disabled.',
      invalidAction: '❌ Invalid action.\nUse: delete | warn | kick',
      actionSet: (a) => `🛡️ Action updated: *${a}*`,
      unknown: '❌ Unknown input.\nType *.antibadword* to see usage.'
    },
    ar: {
      help:
        `🛡️ *Easystep BOT – منع الشتائم*\n` +
        `━━━━━━━━━━━━━━\n\n` +
        `• *.antibadword on*\nتشغيل الحماية\n\n` +
        `• *.antibadword set delete*\nمسح الرسالة\n\n` +
        `• *.antibadword set warn*\nتحذير العضو\n\n` +
        `• *.antibadword set kick*\nطرد العضو\n\n` +
        `• *.antibadword off*\nقفل الحماية\n`,
      alreadyOn: '🟢 الحماية شغالة بالفعل.',
      enabled:
        '✅ تم تشغيل منع الشتائم.\nتقدر تختار الإجراء عبر:\n.antibadword set delete | warn | kick',
      alreadyOff: '🔴 الحماية مقفولة بالفعل.',
      disabled: '❌ تم إيقاف منع الشتائم.',
      invalidAction: '❌ اختيار غير صحيح.\nاستخدم: delete | warn | kick',
      actionSet: (a) => `🛡️ تم تحديث الإجراء إلى: *${a}*`,
      unknown: '❌ أمر غير مفهوم.\nاكتب *.antibadword* لعرض الاستخدام.'
    }
  };

  const T = TXT[lang] || TXT.ar;

  // HELP
  if (!match) {
    await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
    return;
  }

  const input = String(match).trim().toLowerCase();

  // ON
  if (input === 'on') {
    const existing = await getAntiBadword(chatId, 'on');
    if (existing?.enabled) {
      await sock.sendMessage(chatId, { text: T.alreadyOn }, { quoted: message });
      return;
    }

    await setAntiBadword(chatId, 'on', 'delete');
    await sock.sendMessage(chatId, { text: T.enabled }, { quoted: message });
    return;
  }

  // OFF
  if (input === 'off') {
    const config = await getAntiBadword(chatId, 'on');
    if (!config?.enabled) {
      await sock.sendMessage(chatId, { text: T.alreadyOff }, { quoted: message });
      return;
    }

    await removeAntiBadword(chatId);
    await sock.sendMessage(chatId, { text: T.disabled }, { quoted: message });
    return;
  }

  // SET ACTION
  if (input.startsWith('set')) {
    const parts = input.split(/\s+/);
    const action = parts[1];

    if (!['delete', 'kick', 'warn'].includes(action)) {
      await sock.sendMessage(chatId, { text: T.invalidAction }, { quoted: message });
      return;
    }

    await setAntiBadword(chatId, 'on', action);
    await sock.sendMessage(chatId, { text: T.actionSet(action) }, { quoted: message });
    return;
  }

  await sock.sendMessage(chatId, { text: T.unknown }, { quoted: message });
}

/* DETECTION (بدون تغيير في منطقك) */
async function handleBadwordDetection(sock, chatId, message, userMessage, senderId) {
  // اترك منطق الكشف/التنفيذ كما هو عندك
}

module.exports = {
  loadAntibadwordConfig,
  handleAntiBadwordCommand,
  handleBadwordDetection
};