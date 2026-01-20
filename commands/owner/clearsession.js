const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

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
      ownerOnly: '❌ This command can only be used by the owner!',
      notFound: '❌ Session directory not found!',
      starting: '🔍 Optimizing session files for better performance...',
      doneTitle: '✅ Session files cleared successfully!',
      stats: '📊 Statistics:',
      totalCleared: '• Total files cleared:',
      appState: '• App state sync files:',
      preKey: '• Pre-key files:',
      errorsEncountered: '⚠️ Errors encountered:',
      failed: '❌ Failed to clear session files!'
    },
    ar: {
      ownerOnly: '❌ الأمر ده للمالك فقط!',
      notFound: '❌ فولدر السيشن مش موجود!',
      starting: '🔍 جاري تحسين ملفات السيشن لتحسين الأداء...',
      doneTitle: '✅ تم مسح ملفات السيشن بنجاح!',
      stats: '📊 إحصائيات:',
      totalCleared: '• إجمالي الملفات اللي اتمسحت:',
      appState: '• ملفات App State Sync:',
      preKey: '• ملفات Pre-key:',
      errorsEncountered: '⚠️ أخطاء حصلت:',
      failed: '❌ فشل مسح ملفات السيشن!'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

async function clearSessionCommand(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const { lang, T } = TT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '🧹');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const owner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    const sessionDir = path.join(process.cwd(), 'session');

    if (!fs.existsSync(sessionDir)) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.notFound }, { quoted: message });
      return;
    }

    let filesCleared = 0;
    let errors = 0;
    const errorDetails = [];

    await sock.sendMessage(chatId, { text: T.starting }, { quoted: message });

    const files = fs.readdirSync(sessionDir);

    let appStateSyncCount = 0;
    let preKeyCount = 0;

    for (const file of files) {
      if (file.startsWith('app-state-sync-')) appStateSyncCount++;
      if (file.startsWith('pre-key-')) preKeyCount++;
    }

    for (const file of files) {
      if (file === 'creds.json') continue;

      try {
        fs.unlinkSync(path.join(sessionDir, file));
        filesCleared++;
      } catch (err) {
        errors++;
        errorDetails.push(`Failed to delete ${file}: ${err?.message || err}`);
      }
    }

    const finalMsg =
      `${T.doneTitle}\n\n` +
      `${T.stats}\n` +
      `${T.totalCleared} ${filesCleared}\n` +
      `${T.appState} ${appStateSyncCount}\n` +
      `${T.preKey} ${preKeyCount}\n` +
      (errors > 0 ? `\n${T.errorsEncountered} ${errors}\n${errorDetails.join('\n')}` : '');

    await safeReact(sock, chatId, message.key, '✅');
    await sock.sendMessage(chatId, { text: finalMsg }, { quoted: message });
  } catch (error) {
    console.error('[CLEARSESSION]', error?.stack || error);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'clearsession',
  aliases: ['clearsession', 'مسح_السيشن', 'تنظيف_السيشن'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'تنظيف ملفات السيشن (مع الإبقاء على creds.json).',
    en: 'Clear session files (keeps creds.json).'
  },
  usage: {
    ar: 'clearsession',
    en: 'clearsession'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '🧹',
  exec: clearSessionCommand,
  run: clearSessionCommand,
  execute: clearSessionCommand,

  clearSessionCommand
};
