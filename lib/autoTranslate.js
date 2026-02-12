const fs = require('fs');
const path = require('path');
const https = require('https');
const { getLang } = require('../lib/lang');

const DB_PATH = path.join(process.cwd(), 'data', 'autotranslate.json');

function normalizeLang(code) {
  if (!code) return null;
  const c = String(code).trim();
  if (!c) return null;
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

// ✅ ترقية صيغة قديمة: true/false -> {enabled,to}
function getGroupCfg(db, chatId) {
  const v = db?.[chatId];
  if (!v) return { enabled: false, to: 'en' };

  if (v === true) return { enabled: true, to: 'en' };
  if (typeof v === 'string') return { enabled: true, to: normalizeLang(v) || 'en' };

  if (typeof v === 'object') {
    return {
      enabled: !!v.enabled,
      to: normalizeLang(v.to) || 'en'
    };
  }

  return { enabled: false, to: 'en' };
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

function normalizeJid(jid = '') {
  return String(jid).split(':')[0];
}

// Translate via Google Translate (unofficial)
function translate(text, to) {
  return new Promise((resolve) => {
    try {
      const tl = normalizeLang(to) || 'en';
      const q = encodeURIComponent(String(text || '').slice(0, 4000));
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        tl
      )}&dt=t&q=${q}`;

      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);

              const translated = Array.isArray(json?.[0])
                ? json[0].map((x) => x?.[0]).filter(Boolean).join('')
                : '';

              const detectedLang = json?.[2] || null;

              resolve({ translated, detectedLang, to: tl });
            } catch {
              resolve(null);
            }
          });
        })
        .on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

function TXT(chatId) {
  const ar = getLang(chatId) === 'ar';
  return {
    senderLabel: ar ? 'المرسل' : 'Sender',
    translationLabel: ar ? '🌐 الترجمة:' : '🌐 Translation:',
    footer: ar ? '> تمت الترجمة بواسطة EasyStep-bot ©' : '> Translated by EasyStep-bot ©'
  };
}

module.exports = async function autoTranslate(sock, msg) {
  try {
    const chatId = msg?.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) return;
    if (msg?.key?.fromMe) return;

    const db = readDB();
    const cfg = getGroupCfg(db, chatId);
    if (!cfg.enabled) return;

    const raw = getText(msg).trim();
    if (!raw) return;

    // ignore commands
    if (raw.startsWith('.')) return;

    // ignore very short texts (reduce spam)
    if (raw.length < 4) return;

    const target = normalizeLang(cfg.to) || 'en';
    const result = await translate(raw, target);
    if (!result?.translated) return;

    // لو الرسالة أصلاً بنفس لغة الهدف -> متترجمش
    const detected = result.detectedLang ? String(result.detectedLang).toLowerCase() : '';
    const targetLower = String(target).toLowerCase();
    if (detected && detected === targetLower) return;

    const sender = normalizeJid(msg?.key?.participant || msg?.participant);
    if (!sender) return;

    const T = TXT(chatId);
    const mentionTag = `@${sender.replace(/\D/g, '')}`;

    await sock.sendMessage(
      chatId,
      {
        text:
          `${T.senderLabel}: ${mentionTag}\n` +
          `${T.translationLabel}\n` +
          `*${result.translated}*\n\n` +
          `──────────────\n` +
          `${T.footer}`,
        mentions: [sender]
      },
      { quoted: msg }
    );
  } catch {}
};