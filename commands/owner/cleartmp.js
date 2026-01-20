const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

function safeDirName(p) {
  return path.basename(String(p || '')).replace(/[^\w.-]/g, '');
}

function clearDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: false, message: `Directory not found: ${safeDirName(dirPath)}`, count: 0 };
    }

    const files = fs.readdirSync(dirPath);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const stat = fs.lstatSync(filePath);
        if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
        else fs.unlinkSync(filePath);
        deletedCount++;
      } catch {}
    }

    return {
      success: true,
      message: `Cleared ${deletedCount} item(s) in ${safeDirName(dirPath)}`,
      count: deletedCount
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to clear ${safeDirName(dirPath)}`,
      error: error?.message || String(error),
      count: 0
    };
  }
}

async function clearTmpDirectory() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const tempDir = path.join(process.cwd(), 'temp');

  const results = [clearDirectory(tmpDir), clearDirectory(tempDir)];

  const success = results.every((r) => r.success);
  const totalDeleted = results.reduce((sum, r) => sum + (r.count || 0), 0);
  const message = results.map((r) => r.message).join(' | ');

  return { success, message, count: totalDeleted };
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
      okPrefix: '✅',
      failPrefix: '❌',
      failedGeneric: '❌ Failed to clear temporary files!',
      infoTitle: '🧽 Temp Cleaner',
      help:
        'cleartmp\n' +
        '• Clears tmp/ and temp/\n' +
        '• Auto-clear runs every 6 hours'
    },
    ar: {
      ownerOnly: '❌ الأمر ده للمالك فقط!',
      okPrefix: '✅',
      failPrefix: '❌',
      failedGeneric: '❌ فشل مسح الملفات المؤقتة!',
      infoTitle: '🧽 منظّف الملفات المؤقتة',
      help:
        'cleartmp\n' +
        '• بيمسح tmp و temp\n' +
        '• التنظيف التلقائي كل 6 ساعات'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

async function clearTmpCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const { T } = TT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '🧽');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const owner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    const result = await clearTmpDirectory();

    if (result.success) {
      await safeReact(sock, chatId, message.key, '✅');
      await sock.sendMessage(chatId, { text: `${T.okPrefix} ${result.message}` }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: `${T.failPrefix} ${result.message}` }, { quoted: message });
  } catch (error) {
    console.error('[CLEARTMP]', error?.stack || error);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: TT(chatId).T.failedGeneric }, { quoted: message }).catch(() => {});
  }
}

let __AUTO_CLEAR_STARTED__ = false;

function startAutoClear() {
  if (__AUTO_CLEAR_STARTED__) return;
  __AUTO_CLEAR_STARTED__ = true;

  clearTmpDirectory().then((result) => {
    if (!result.success) console.error(`[Auto Clear] ${result.message}`);
  });

  setInterval(async () => {
    const result = await clearTmpDirectory();
    if (!result.success) console.error(`[Auto Clear] ${result.message}`);
  }, 6 * 60 * 60 * 1000);
}

startAutoClear();

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'cleartmp',
  aliases: ['cleartmp', 'مسح_المؤقت', 'تنظيف_المؤقت'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'تنظيف ملفات tmp و temp (مع تشغيل تنظيف تلقائي كل 6 ساعات).',
    en: 'Clear tmp and temp folders (with auto-clear every 6 hours).'
  },
  usage: {
    ar: 'cleartmp',
    en: 'cleartmp'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '🧽',
  exec: clearTmpCommand,
  run: clearTmpCommand,
  execute: clearTmpCommand,

  clearTmpCommand,
  clearTmpDirectory,
  startAutoClear
};
