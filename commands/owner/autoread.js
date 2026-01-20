const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'autoread.json');

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

function isAutoreadEnabled() {
  try {
    const cfg = readConfig();
    return !!cfg.enabled;
  } catch {
    return false;
  }
}

function isBotMentionedInMessage(message, botJid) {
  try {
    if (!message?.message) return false;

    const types = [
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'stickerMessage',
      'documentMessage',
      'audioMessage',
      'contactMessage',
      'locationMessage'
    ];

    for (const t of types) {
      const mentioned = message.message?.[t]?.contextInfo?.mentionedJid;
      if (Array.isArray(mentioned) && mentioned.some((jid) => jid === botJid)) return true;
    }

    const textContent =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      '';

    if (textContent) {
      const botUsername = String(botJid || '').split('@')[0];
      if (botUsername && String(textContent).includes(`@${botUsername}`)) return true;

      const botNames = [
        String(global.botname || '').toLowerCase(),
        'bot',
        'easystep',
        'easystep bot'
      ].filter(Boolean);

      const words = String(textContent).toLowerCase().split(/\s+/).filter(Boolean);
      if (botNames.some((name) => words.includes(name))) return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function handleAutoread(sock, message) {
  try {
    if (!isAutoreadEnabled()) return false;

    const rawId = String(sock?.user?.id || '');
    const botJid = rawId ? `${rawId.split(':')[0]}@s.whatsapp.net` : '';

    const mentioned = botJid ? isBotMentionedInMessage(message, botJid) : false;
    if (mentioned) return false;

    const key = {
      remoteJid: message?.key?.remoteJid,
      id: message?.key?.id,
      participant: message?.key?.participant
    };

    if (!key.remoteJid || !key.id) return false;

    await sock.readMessages([key]).catch(() => {});
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

async function autoreadCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {
    en: {
      ownerOnly: '❌ This command is only available for the owner!',
      invalid: '❌ Invalid option! Use: autoread on/off',
      ok: (enabled) => `✅ Auto-read has been ${enabled ? 'enabled' : 'disabled'}!`,
      err: '❌ Error processing command!'
    },
    ar: {
      ownerOnly: '❌ هذا الأمر متاح للمالك فقط!',
      invalid: '❌ خيار غير صحيح! استخدم: autoread on/off',
      ok: (enabled) => `✅ تم ${enabled ? 'تفعيل' : 'إيقاف'} القراءة التلقائية!`,
      err: '❌ حصل خطأ أثناء تنفيذ الأمر!'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await safeReact(sock, chatId, message.key, '👁️');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const owner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
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
        await sock.sendMessage(chatId, { text: T.invalid }, { quoted: message });
        return;
      }
    } else {
      cfg.enabled = !cfg.enabled;
    }

    const ok = writeConfig(cfg);
    if (!ok) throw new Error('write failed');

    await sock.sendMessage(chatId, { text: T.ok(cfg.enabled) }, { quoted: message });
    await safeReact(sock, chatId, message.key, '✅');
  } catch (e) {
    console.error('[AUTOREAD]', e?.stack || e);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: (TXT[lang]?.err || TXT.en.err) }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'autoread',
  aliases: ['autoread', 'قراءة_تلقائي', 'قراءة_تلقائية'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'تفعيل أو إيقاف القراءة التلقائية للرسائل (مع تجاهل الرسائل اللي فيها منشن للبوت).',
    en: 'Enable/disable auto-read (ignores messages that mention the bot).'
  },
  usage: {
    ar: 'autoread on/off (أو بدون اختيار للتبديل)',
    en: 'autoread on/off (or without option to toggle)'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '👁️',
  exec: autoreadCommand,
  run: autoreadCommand,
  execute: autoreadCommand,

  handleAutoread,
  isAutoreadEnabled,
  isBotMentionedInMessage,
  autoreadCommand
};
