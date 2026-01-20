const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'autotyping.json');

function ensureConfigFile() {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: false }, null, 2));
  } catch {}
}

function readConfig() {
  try {
    ensureConfigFile();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}') || { enabled: false };
  } catch {
    return { enabled: false };
  }
}

function writeConfig(cfg) {
  try {
    ensureConfigFile();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    return true;
  } catch {
    return false;
  }
}

function t(chatId, map) {
  const lang = getLang(chatId);
  return map[lang] || map.en || '';
}

function isAutotypingEnabled() {
  try {
    return !!readConfig().enabled;
  } catch {
    return false;
  }
}

async function handleAutotypingForMessage(sock, chatId, userMessage) {
  if (!isAutotypingEnabled()) return false;

  try {
    await sock.presenceSubscribe(chatId).catch(() => {});
    await sock.sendPresenceUpdate('available', chatId).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));

    await sock.sendPresenceUpdate('composing', chatId).catch(() => {});

    const len = String(userMessage || '').length;
    const typingDelay = Math.max(3000, Math.min(8000, len * 150));
    await new Promise((r) => setTimeout(r, typingDelay));

    await sock.sendPresenceUpdate('paused', chatId).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function handleAutotypingForCommand(sock, chatId) {
  if (!isAutotypingEnabled()) return false;

  try {
    await sock.presenceSubscribe(chatId).catch(() => {});
    await sock.sendPresenceUpdate('composing', chatId).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    await sock.sendPresenceUpdate('paused', chatId).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function showTypingAfterCommand(sock, chatId) {
  if (!isAutotypingEnabled()) return false;

  try {
    await sock.presenceSubscribe(chatId).catch(() => {});
    await sock.sendPresenceUpdate('composing', chatId).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    await sock.sendPresenceUpdate('paused', chatId).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function autotypingCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  try {
    await safeReact(sock, chatId, message.key, '⌨️');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const owner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(
        chatId,
        {
          text: t(chatId, {
            en: '❌ This command is only available for the owner!',
            ar: '❌ هذا الأمر متاح للمالك فقط!'
          })
        },
        { quoted: message }
      );
      return;
    }

    let action = String((Array.isArray(args) && args[0]) || '').toLowerCase().trim();

    if (!action) {
      const rawText =
        message.message?.conversation?.trim() ||
        message.message?.extendedTextMessage?.text?.trim() ||
        '';

      const parsed = rawText ? rawText.split(/\s+/).slice(1) : [];
      action = String(parsed[0] || '').toLowerCase().trim();
    }

    const cfg = readConfig();

    if (action) {
      if (action === 'on' || action === 'enable') cfg.enabled = true;
      else if (action === 'off' || action === 'disable') cfg.enabled = false;
      else {
        await safeReact(sock, chatId, message.key, '❌');
        await sock.sendMessage(
          chatId,
          {
            text: t(chatId, {
              en: '❌ Invalid option! Use: autotyping on/off',
              ar: '❌ خيار غير صحيح! استخدم: autotyping on/off'
            })
          },
          { quoted: message }
        );
        return;
      }
    } else {
      cfg.enabled = !cfg.enabled;
    }

    const ok = writeConfig(cfg);
    if (!ok) throw new Error('write failed');

    await sock.sendMessage(
      chatId,
      {
        text: t(chatId, {
          en: `✅ Auto-typing has been ${cfg.enabled ? 'enabled' : 'disabled'}!`,
          ar: `✅ تم ${cfg.enabled ? 'تفعيل' : 'إيقاف'} الكتابة الوهمية!`
        })
      },
      { quoted: message }
    );

    await safeReact(sock, chatId, message.key, '✅');
  } catch (e) {
    console.error('[AUTOTYPING]', e?.stack || e);
    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(
      chatId,
      {
        text: t(chatId, {
          en: '❌ Error processing command!',
          ar: '❌ حصل خطأ أثناء تنفيذ الأمر!'
        })
      },
      { quoted: message }
    ).catch(() => {});
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'autotyping',
  aliases: ['autotyping', 'كتابة_وهمية', 'تايبنج'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'تفعيل أو إيقاف الكتابة الوهمية (Typing) قبل ردود البوت.',
    en: 'Enable/disable fake typing (Typing) before bot replies.'
  },
  usage: {
    ar: 'autotyping on/off (أو بدون اختيار للتبديل)',
    en: 'autotyping on/off (or without option to toggle)'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '⌨️',
  exec: autotypingCommand,
  run: autotypingCommand,
  execute: autotypingCommand,

  isAutotypingEnabled,
  handleAutotypingForMessage,
  handleAutotypingForCommand,
  showTypingAfterCommand,
  autotypingCommand
};
