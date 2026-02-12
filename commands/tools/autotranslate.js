const fs = require('fs');
const path = require('path');

const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const DB_PATH = path.join(process.cwd(), 'data', 'autotranslate.json');

function normalizeLang(code) {
  if (!code) return null;
  const c = String(code).trim();
  if (!c) return null;

  // allow: en / ar / fr / zh / zh-CN / pt-BR
  if (!/^[a-z]{2,3}(-[a-zA-Z]{2})?$/.test(c)) return null;

  const parts = c.split('-');
  const base = parts[0].toLowerCase();
  const region = parts[1] ? parts[1].toUpperCase() : '';
  return region ? `${base}-${region}` : base;
}

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeDB(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db || {}, null, 2));
  } catch {}
}

// ✅ ترقية صيغة قديمة: true/false -> {enabled,to}
function getGroupCfg(db, chatId) {
  const v = db?.[chatId];
  if (!v) return { enabled: false, to: 'en' };

  if (v === true) return { enabled: true, to: 'en' };
  if (typeof v === 'string') return { enabled: true, to: normalizeLang(v) || 'en' };

  if (typeof v === 'object') {
    const enabled = !!v.enabled;
    const to = normalizeLang(v.to) || 'en';
    return { enabled, to };
  }

  return { enabled: false, to: 'en' };
}

function setGroupCfg(db, chatId, cfg) {
  db[chatId] = { enabled: !!cfg.enabled, to: normalizeLang(cfg.to) || 'en' };
  return db;
}

function TXT(chatId) {
  const ar = getLang(chatId) === 'ar';
  return {
    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command works in groups only.',
    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',
    needSenderAdmin: ar ? '❌ الأمر ده للأدمنية بس.' : '❌ Only group admins can use this command.',

    on: (to) => (ar ? `✅ تم تشغيل الترجمة التلقائية. (إلى: ${to})` : `✅ Auto-translate enabled. (To: ${to})`),
    off: ar ? '🛑 تم إيقاف الترجمة التلقائية.' : '🛑 Auto-translate disabled.',
    status: (enabled, to) =>
      ar
        ? `🌐 الترجمة التلقائية: ${enabled ? 'شغالة ✅' : 'مقفولة 🛑'}\n🎯 اللغة: ${to}`
        : `🌐 Auto-translate: ${enabled ? 'ON ✅' : 'OFF 🛑'}\n🎯 Target: ${to}`,

    setTo: (to) => (ar ? `🎯 تم ضبط اللغة إلى: ${to}` : `🎯 Target language set to: ${to}`),
    badLang: ar ? '❌ كود لغة غير صحيح (مثال: en / ar / fr / zh-CN).' : '❌ Invalid language code (e.g., en / ar / fr / zh-CN).',

    usage: ar
      ? 'استخدم:\n.autotranslate on\n.autotranslate off\n.autotranslate to <lang>\n.autotranslate'
      : 'Use:\n.autotranslate on\n.autotranslate off\n.autotranslate to <lang>\n.autotranslate'
  };
}

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

async function handle(sock, chatId, message, args = [], senderId, isSenderAdmin) {
  if (!chatId) return;
  const T = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {
    await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message });
    return;
  }

  const realSenderId =
    senderId ||
    message?.key?.participant ||
    message?.participant ||
    message?.key?.remoteJid;

  const adminStatus = await isAdmin(sock, chatId, realSenderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {
    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message });
    return;
  }

  const senderAdmin = typeof isSenderAdmin === 'boolean' ? isSenderAdmin : !!adminStatus?.isSenderAdmin;
  if (!senderAdmin && !message?.key?.fromMe) {
    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message });
    return;
  }

  const raw = getText(message).trim();
  const used = (raw.split(/\s+/)[0] || '').toLowerCase();
  const cmd = used.startsWith('.') ? used.slice(1) : used;

  if (cmd !== 'autotranslate' && cmd !== 'ترجمة') {
    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    return;
  }

  const a0 = String(args?.[0] || '').trim().toLowerCase();
  const a1 = String(args?.[1] || '').trim();

  const db = readDB();
  let cfg = getGroupCfg(db, chatId);

  // .autotranslate  -> status
  if (!a0) {
    await sock.sendMessage(chatId, { text: T.status(cfg.enabled, cfg.to) }, { quoted: message });
    return;
  }

  // on/off
  if (a0 === 'on' || a0 === 'تشغيل') {
    cfg.enabled = true;
    cfg.to = cfg.to || 'en';
    setGroupCfg(db, chatId, cfg);
    writeDB(db);
    await sock.sendMessage(chatId, { text: T.on(cfg.to) }, { quoted: message });
    return;
  }

  if (a0 === 'off' || a0 === 'ايقاف' || a0 === 'إيقاف') {
    // نخزن enabled=false بدل ما نمسح عشان نحتفظ باللغة
    cfg.enabled = false;
    setGroupCfg(db, chatId, cfg);
    writeDB(db);
    await sock.sendMessage(chatId, { text: T.off }, { quoted: message });
    return;
  }

  // to <lang>  OR lang <lang>
  if (a0 === 'to' || a0 === 'lang' || a0 === 'لغة') {
    const langCode = normalizeLang(a1);
    if (!langCode) {
      await sock.sendMessage(chatId, { text: T.badLang }, { quoted: message });
      return;
    }
    cfg.to = langCode || 'en';
    cfg.enabled = true; // ضبط اللغة يشغلها تلقائيًا
    setGroupCfg(db, chatId, cfg);
    writeDB(db);
    await sock.sendMessage(chatId, { text: T.setTo(cfg.to) }, { quoted: message });
    return;
  }

  // اختصار: .autotranslate fr
  const maybeLang = normalizeLang(args?.[0]);
  if (maybeLang) {
    cfg.to = maybeLang;
    cfg.enabled = true;
    setGroupCfg(db, chatId, cfg);
    writeDB(db);
    await sock.sendMessage(chatId, { text: T.setTo(cfg.to) }, { quoted: message });
    return;
  }

  await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
}

module.exports = {
  name: 'autotranslate',
  aliases: ['ترجمة', 'autotr', 'atr'],
  category: { ar: '🤖 أدوات EasyStep', en: '🤖 Easystep Tools' },
  description: {
    ar: 'تشغيل/إيقاف ترجمة تلقائية للجروب مع اختيار لغة الهدف (الافتراضي EN).',
    en: 'Enable/disable auto-translate with a target language (default EN).'
  },
  usage: {
    ar: '.autotranslate on/off | to <lang>',
    en: '.autotranslate on/off | to <lang>'
  },
  emoji: '🌐',
  admin: true,
  owner: false,
  showInMenu: true,
  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),
  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),
  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args)
};