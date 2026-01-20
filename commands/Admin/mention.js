const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getLang } = require('../../lib/lang');

const STATE_PATH = path.join(process.cwd(), 'data', 'mention.json');

function TXT(chatId) {
  const lang = getLang(chatId);
  const ar = lang === 'ar';

  return {
    lang,
    onlyAdmin: ar ? '❌ الأمر ده للأدمنز بس.' : '❌ Admins only.',
    help:
      (ar ? '*رد المنشن*\n\n' : '*Mention Reply*\n\n') +
      (ar
        ? '• .mention on  - تشغيل\n• .mention off - إيقاف\n• .mention set - تخصيص الرد (رد على رسالة/ميديا ثم اكتب الأمر)\n\nملحوظة: لو مفيش رد مخصص، البوت هيرد بـ 🗣'
        : '• .mention on  - Enable\n• .mention off - Disable\n• .mention set - Set custom reply (reply to msg/media then run)\n\nNote: If no custom reply, bot replies with 🗣'),
    enabled: ar ? '✅ تم تشغيل رد المنشن.' : '✅ Mention reply enabled.',
    disabled: ar ? '⛔ تم إيقاف رد المنشن.' : '⛔ Mention reply disabled.',
    replyToSomething: ar
      ? 'ℹ️ رد على رسالة أو ميديا (ستيكر/صورة/فيديو/صوت/ملف نصي).'
      : 'ℹ️ Reply to a message or media (sticker/image/video/audio/text).',
    unsupported: ar ? '❌ النوع غير مدعوم.' : '❌ Unsupported type.',
    emptyText: ar ? '❌ النص فاضي.' : '❌ Empty text.',
    dlFail: ar ? '❌ فشل تحميل الميديا.' : '❌ Failed to download media.',
    tooLarge: ar ? '❌ الملف كبير (الحد الأقصى 1MB).' : '❌ File too large (max 1MB).',
    saveFail: ar ? '❌ فشل حفظ الرد.' : '❌ Failed to save reply.',
    updated: ar ? '✅ تم تحديث رد المنشن.' : '✅ Mention reply updated.',
    defaultReply: '🗣'
  };
}

function ensureState() {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STATE_PATH)) {
      fs.writeFileSync(STATE_PATH, JSON.stringify({ enabled: false, type: 'text', assetPath: '' }, null, 2));
    }
  } catch {}
}

function loadState() {
  try {
    ensureState();
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8') || '{}') || {};
    return {
      enabled: !!s.enabled,
      type: s.type || 'text',
      assetPath: typeof s.assetPath === 'string' ? s.assetPath : '',
      mimetype: s.mimetype,
      ptt: s.ptt,
      gifPlayback: s.gifPlayback
    };
  } catch {
    return { enabled: false, type: 'text', assetPath: '' };
  }
}

function saveState(state) {
  try {
    ensureState();
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch {}
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function getBotData(sock) {
  const rawId = sock.user?.id || sock.user?.jid || '';
  const num = rawId ? rawId.split('@')[0].split(':')[0] : '';
  const jids = [
    num ? `${num}@s.whatsapp.net` : '',
    num ? `${num}@whatsapp.net` : '',
    rawId
  ].filter(Boolean);
  return { num, jids };
}

function extractText(message) {
  const m = message.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).toString();
}

function extractMentions(message) {
  const msg = message.message || {};
  const contexts = [
    msg.extendedTextMessage?.contextInfo,
    msg.imageMessage?.contextInfo,
    msg.videoMessage?.contextInfo,
    msg.documentMessage?.contextInfo,
    msg.stickerMessage?.contextInfo,
    msg.buttonsResponseMessage?.contextInfo,
    msg.listResponseMessage?.contextInfo
  ].filter(Boolean);

  let mentioned = [];
  for (const c of contexts) {
    if (Array.isArray(c.mentionedJid)) mentioned = mentioned.concat(c.mentionedJid);
  }

  const extra = [msg.extendedTextMessage?.mentionedJid, msg.mentionedJid].filter(Array.isArray);
  for (const arr of extra) mentioned = mentioned.concat(arr);

  return [...new Set(mentioned.filter(Boolean))];
}

function cleanupOldMentionCustomFiles() {
  try {
    const assetsDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) return;
    const files = fs.readdirSync(assetsDir);
    for (const f of files) {
      if (f.startsWith('mention_custom.')) {
        try { fs.unlinkSync(path.join(assetsDir, f)); } catch {}
      }
    }
  } catch {}
}

function pickExt(type, mimetype = '') {
  if (type === 'sticker') return 'webp';
  if (type === 'image') return mimetype.includes('png') ? 'png' : 'jpg';
  if (type === 'video') return 'mp4';
  if (type === 'audio') {
    if (mimetype.includes('ogg') || mimetype.includes('opus')) return 'ogg';
    if (mimetype.includes('m4a') || mimetype.includes('mp4')) return 'm4a';
    if (mimetype.includes('wav')) return 'wav';
    if (mimetype.includes('aac')) return 'aac';
    return 'mp3';
  }
  return 'txt';
}

async function handleMentionDetection(sock, chatId, message) {
  try {
    if (message.key?.fromMe) return;

    const state = loadState();
    if (!state.enabled) return;

    const { num, jids } = getBotData(sock);
    if (!num) return;

    const mentions = extractMentions(message);
    const rawText = extractText(message);

    let isMention = mentions.some(j => jids.includes(j));
    if (!isMention && rawText) {
      const safeBot = num.replace(/[-\s]/g, '');
      const re = new RegExp(`@?${safeBot}\\b`);
      isMention = re.test(rawText.replace(/\s+/g, ''));
    }

    if (!isMention) return;

    const T = TXT(chatId);

    if (!state.assetPath) {
      await sock.sendMessage(chatId, { text: T.defaultReply }, { quoted: message });
      return;
    }

    const abs = path.join(process.cwd(), state.assetPath);
    if (!fs.existsSync(abs)) {
      await sock.sendMessage(chatId, { text: T.defaultReply }, { quoted: message });
      return;
    }

    if (state.type === 'sticker') {
      await sock.sendMessage(chatId, { sticker: fs.readFileSync(abs) }, { quoted: message });
      return;
    }

    const payload = {};
    if (state.type === 'image') payload.image = fs.readFileSync(abs);
    else if (state.type === 'video') {
      payload.video = fs.readFileSync(abs);
      if (state.gifPlayback) payload.gifPlayback = true;
    }
    else if (state.type === 'audio') {
      payload.audio = fs.readFileSync(abs);
      payload.mimetype = state.mimetype || 'audio/mpeg';
      if (typeof state.ptt === 'boolean') payload.ptt = state.ptt;
    }
    else payload.text = fs.readFileSync(abs, 'utf8');

    await sock.sendMessage(chatId, payload, { quoted: message });
  } catch (e) {
    console.error('MENTION EVENT ERROR:', e);
  }
}

async function mentionCommand(sock, message, args = [], senderId, isSenderAdmin) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const T = TXT(chatId);

  await safeReact(sock, chatId, message.key, '🗣️');

  if (!isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.onlyAdmin }, { quoted: message });
    return;
  }

  const sub = String(args?.[0] || '').toLowerCase().trim();

  if (!sub) {
    await safeReact(sock, chatId, message.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
    return;
  }

  if (sub === 'on' || sub === 'off') {
    const st = loadState();
    st.enabled = sub === 'on';
    saveState(st);

    await safeReact(sock, chatId, message.key, st.enabled ? '🔔' : '🔕');
    await sock.sendMessage(chatId, { text: st.enabled ? T.enabled : T.disabled }, { quoted: message });
    return;
  }

  if (sub === 'set') {
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    const q = ctx?.quotedMessage;

    if (!q) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.replyToSomething }, { quoted: message });
      return;
    }

    let type = 'text';
    let dataKey = null;

    if (q.stickerMessage) { type = 'sticker'; dataKey = 'stickerMessage'; }
    else if (q.imageMessage) { type = 'image'; dataKey = 'imageMessage'; }
    else if (q.videoMessage) { type = 'video'; dataKey = 'videoMessage'; }
    else if (q.audioMessage) { type = 'audio'; dataKey = 'audioMessage'; }
    else if (q.conversation || q.extendedTextMessage?.text) { type = 'text'; }
    else {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.unsupported }, { quoted: message });
      return;
    }

    let buf = Buffer.from([]);
    let mimetype = dataKey ? (q[dataKey]?.mimetype || '') : '';

    if (type === 'text') {
      buf = Buffer.from(q.conversation || q.extendedTextMessage?.text || '', 'utf8');
      if (!buf.length) {
        await safeReact(sock, chatId, message.key, '❌');
        await sock.sendMessage(chatId, { text: T.emptyText }, { quoted: message });
        return;
      }
    } else {
      try {
        const media = q[dataKey];
        const kind =
          type === 'sticker' ? 'sticker' :
          type === 'image' ? 'image' :
          type === 'video' ? 'video' :
          'audio';
        const stream = await downloadContentFromMessage(media, kind);
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        buf = Buffer.concat(chunks);
      } catch {
        await safeReact(sock, chatId, message.key, '❌');
        await sock.sendMessage(chatId, { text: T.dlFail }, { quoted: message });
        return;
      }
    }

    if (buf.length > 1024 * 1024) {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.tooLarge }, { quoted: message });
      return;
    }

    const assetsDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    cleanupOldMentionCustomFiles();

    const ext = pickExt(type, mimetype);
    const fileName = `mention_custom.${ext}`;
    const filePath = path.join(assetsDir, fileName);

    try {
      fs.writeFileSync(filePath, buf);
    } catch {
      await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: T.saveFail }, { quoted: message });
      return;
    }

    const st = loadState();
    st.assetPath = path.join('assets', fileName);
    st.type = type;

    if (type === 'audio') {
      st.mimetype = mimetype || st.mimetype || 'audio/mpeg';
      st.ptt = !!q.audioMessage?.ptt;
    } else {
      delete st.mimetype;
      delete st.ptt;
    }

    if (type === 'video') st.gifPlayback = !!q.videoMessage?.gifPlayback;
    else delete st.gifPlayback;

    saveState(st);

    await safeReact(sock, chatId, message.key, '📝');
    await sock.sendMessage(chatId, { text: T.updated }, { quoted: message });
    return;
  }

  await safeReact(sock, chatId, message.key, 'ℹ️');
  await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
}

module.exports = {
  handleMentionDetection,
  mentionCommand
};

module.exports.command = {
  name: 'mention',
  aliases: ['mention', 'setmention', 'منشن', 'رد_منشن'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'بيخلي البوت يرد تلقائيًا لما أي حد يعمل له منشن داخل الجروب، مع إمكانية تخصيص الرد كنص أو ميديا.',
    en: 'Makes the bot auto-reply when mentioned in the group, with custom text or media replies.'
  },
  emoji: '🔔',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: mentionCommand,
  run: mentionCommand,
  execute: (sock, message, args) => mentionCommand(sock, message, args)
};