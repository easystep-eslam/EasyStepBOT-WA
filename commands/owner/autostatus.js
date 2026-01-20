const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'autoStatus.json');

function ensureConfigFile() {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: false, reactOn: false }, null, 2));
    }
  } catch {}
}

function readConfig() {
  try {
    ensureConfigFile();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}') || { enabled: false, reactOn: false };
  } catch {
    return { enabled: false, reactOn: false };
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

function TT(chatId) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      ownerOnly: '❌ This command can only be used by the owner!',
      invalid: '❌ Invalid command!',
      err: '❌ Error managing auto status!',
      settingsTitle: '🔄 Auto Status Settings',
      autoView: 'Auto Status View',
      reactions: 'Status Reactions',
      enabled: 'enabled',
      disabled: 'disabled',
      help:
        'autostatus on\n' +
        'autostatus off\n' +
        'autostatus react on\n' +
        'autostatus react off',
      onOk: '✅ Auto status view enabled!',
      offOk: '❌ Auto status view disabled!',
      reactOnOk: '💫 Status reactions enabled!',
      reactOffOk: '❌ Status reactions disabled!'
    },
    ar: {
      ownerOnly: '❌ هذا الأمر للمالك فقط!',
      invalid: '❌ أمر غير صحيح!',
      err: '❌ حصل خطأ أثناء إدارة الاستاتس!',
      settingsTitle: '🔄 إعدادات مشاهدة الاستاتس',
      autoView: 'مشاهدة الاستاتس تلقائيًا',
      reactions: 'التفاعل مع الاستاتس',
      enabled: 'مفعل',
      disabled: 'غير مفعل',
      help:
        'autostatus on\n' +
        'autostatus off\n' +
        'autostatus react on\n' +
        'autostatus react off',
      onOk: '✅ تم تفعيل مشاهدة الاستاتس تلقائيًا!',
      offOk: '❌ تم إيقاف مشاهدة الاستاتس تلقائيًا!',
      reactOnOk: '💫 تم تفعيل التفاعل مع الاستاتس!',
      reactOffOk: '❌ تم إيقاف التفاعل مع الاستاتس!'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

function isAutoStatusEnabled() {
  try {
    const cfg = readConfig();
    return !!cfg.enabled;
  } catch {
    return false;
  }
}

function isStatusReactionEnabled() {
  try {
    const cfg = readConfig();
    return !!cfg.reactOn;
  } catch {
    return false;
  }
}

async function reactToStatus(sock, statusKey) {
  try {
    if (!isStatusReactionEnabled()) return;
    if (!statusKey?.id) return;

    await sock.relayMessage(
      'status@broadcast',
      {
        reactionMessage: {
          key: {
            remoteJid: 'status@broadcast',
            id: statusKey.id,
            participant: statusKey.participant || statusKey.remoteJid,
            fromMe: false
          },
          text: '💚'
        }
      },
      {
        messageId: statusKey.id,
        statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
      }
    );
  } catch {}
}

async function handleStatusUpdate(sock, status) {
  try {
    if (!isAutoStatusEnabled()) return false;

    await new Promise((r) => setTimeout(r, 1000));

    if (Array.isArray(status?.messages) && status.messages.length > 0) {
      const msg = status.messages[0];
      if (msg?.key?.remoteJid === 'status@broadcast') {
        await sock.readMessages([msg.key]).catch(() => {});
        await reactToStatus(sock, msg.key);
        return true;
      }
    }

    if (status?.key?.remoteJid === 'status@broadcast') {
      await sock.readMessages([status.key]).catch(() => {});
      await reactToStatus(sock, status.key);
      return true;
    }

    if (status?.reaction?.key?.remoteJid === 'status@broadcast') {
      await sock.readMessages([status.reaction.key]).catch(() => {});
      await reactToStatus(sock, status.reaction.key);
      return true;
    }

    return false;
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

async function autoStatusCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const { T } = TT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '💫');

    const senderId = message?.key?.participant || message?.key?.remoteJid;
    const owner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !owner) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    const cfg = readConfig();

    if (!Array.isArray(args) || args.length === 0) {
      const status = cfg.enabled ? T.enabled : T.disabled;
      const reactStatus = cfg.reactOn ? T.enabled : T.disabled;

      const text =
        `${T.settingsTitle}\n\n` +
        `${T.autoView}: ${status}\n` +
        `${T.reactions}: ${reactStatus}\n\n` +
        `${T.help}`;

      await sock.sendMessage(chatId, { text }, { quoted: message });
      await safeReact(sock, chatId, message.key, '✅');
      return;
    }

    const command = String(args[0] || '').toLowerCase();

    if (command === 'on') {
      cfg.enabled = true;
      writeConfig(cfg);
      await sock.sendMessage(chatId, { text: T.onOk }, { quoted: message });
      await safeReact(sock, chatId, message.key, '✅');
      return;
    }

    if (command === 'off') {
      cfg.enabled = false;
      writeConfig(cfg);
      await sock.sendMessage(chatId, { text: T.offOk }, { quoted: message });
      await safeReact(sock, chatId, message.key, '✅');
      return;
    }

    if (command === 'react') {
      const reactCmd = String(args[1] || '').toLowerCase();

      if (reactCmd === 'on') {
        cfg.reactOn = true;
        writeConfig(cfg);
        await sock.sendMessage(chatId, { text: T.reactOnOk }, { quoted: message });
        await safeReact(sock, chatId, message.key, '✅');
        return;
      }

      if (reactCmd === 'off') {
        cfg.reactOn = false;
        writeConfig(cfg);
        await sock.sendMessage(chatId, { text: T.reactOffOk }, { quoted: message });
        await safeReact(sock, chatId, message.key, '✅');
        return;
      }

      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.invalid }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.invalid }, { quoted: message });
  } catch (e) {
    console.error('[AUTOSTATUS]', e?.stack || e);
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.err }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'autostatus',
  aliases: ['autostatus', 'استاتس_تلقائي', 'مشاهدة_الاستاتس'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'مشاهدة الاستاتس والتفاعل معها تلقائيًا (اختياري).',
    en: 'Auto view statuses and optionally react to them.'
  },
  usage: {
    ar: 'autostatus on/off | autostatus react on/off',
    en: 'autostatus on/off | autostatus react on/off'
  },
  admin: false,
  owner: true,
  showInMenu: true,
  emoji: '💫',
  exec: autoStatusCommand,
  run: autoStatusCommand,
  execute: autoStatusCommand,

  handleStatusUpdate
};