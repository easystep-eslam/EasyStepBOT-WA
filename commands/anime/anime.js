const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');
const { getLang } = require('../../lib/lang');

const ANIMU_BASE = 'https://api.some-random-api.com/animu';

function normalizeType(input) {
  const lower = String(input || '').toLowerCase().trim();
  if (lower === 'facepalm' || lower === 'face_palm') return 'face-palm';
  if (lower === 'quote' || lower === 'animu-quote' || lower === 'animuquote') return 'quote';
  return lower;
}

function getTextFromMessage(msg) {
  return (
    msg?.message?.conversation?.trim() ||
    msg?.message?.extendedTextMessage?.text?.trim() ||
    msg?.message?.imageMessage?.caption?.trim() ||
    msg?.message?.videoMessage?.caption?.trim() ||
    ''
  );
}

function TR(chatId) {
  const lang = getLang(chatId);
  const isAr = lang === 'ar';
  return {
    lang,
    isAr,
    react: '🖼️',
    usage: isAr
      ? 'الاستخدام:\n.animu <النوع>\nمثال: .animu hug'
      : 'Usage:\n.animu <type>\nExample: .animu hug',
    typesLabel: isAr ? 'الأنواع المتاحة:' : 'Available types:',
    unsupported: (sub, list) =>
      isAr
        ? `❌ النوع غير مدعوم: ${sub}\nجرّب واحد من:\n${list}`
        : `❌ Unsupported type: ${sub}\nTry one of:\n${list}`,
    fetchFailed: isAr ? '❌ فشل في جلب أنمي.' : '❌ Failed to fetch animu.',
    errorFetch: isAr ? '❌ حصل خطأ أثناء جلب الأنمي.' : '❌ An error occurred while fetching animu.',
    caption: (type) => (isAr ? `🖼️ أنمي: ${type}` : `🖼️ Anime: ${type}`),
    stickerPackName: isAr ? 'ملصقات أنمي' : 'Anime Stickers'
  };
}

async function convertMediaToSticker(mediaBuffer, isAnimated, stickerPackName) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const stamp = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const inputExt = isAnimated ? 'gif' : 'jpg';
  const input = path.join(tmpDir, `animu_${stamp}.${inputExt}`);
  const output = path.join(tmpDir, `animu_${stamp}.webp`);

  fs.writeFileSync(input, mediaBuffer);

  const ffmpegCmd = isAnimated
    ? `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 60 -compression_level 6 "${output}"`
    : `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${output}"`;

  await new Promise((resolve, reject) => {
    exec(ffmpegCmd, (err) => (err ? reject(err) : resolve()));
  });

  const webpBuffer = fs.readFileSync(output);

  const img = new webp.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': stickerPackName,
    emojis: ['🎌']
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ]);

  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  img.exif = exif;

  const finalBuffer = await img.save(null);

  try { fs.unlinkSync(input); } catch {}
  try { fs.unlinkSync(output); } catch {}

  return finalBuffer;
}

async function sendAnimu(sock, chatId, message, type) {
  const tr = TR(chatId);

  const endpoint = `${ANIMU_BASE}/${type}`;
  const res = await axios.get(endpoint, { timeout: 20000 });
  const data = res.data || {};

  if (data.link) {
    const link = String(data.link);
    const lower = link.toLowerCase();
    const isGifLink = lower.endsWith('.gif');
    const isImageLink = /\.(jpg|jpeg|png|webp)$/.test(lower);

    if (isGifLink || isImageLink) {
      try {
        const resp = await axios.get(link, {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const mediaBuf = Buffer.from(resp.data);
        const stickerBuf = await convertMediaToSticker(mediaBuf, isGifLink, tr.stickerPackName);

        await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: message });
        return;
      } catch (error) {
        console.error('[ANIMU] sticker convert error:', error?.message || error);
      }
    }

    try {
      await sock.sendMessage(
        chatId,
        { image: { url: link }, caption: tr.caption(type) },
        { quoted: message }
      );
      return;
    } catch {}
  }

  if (data.quote) {
    await sock.sendMessage(chatId, { text: String(data.quote) }, { quoted: message });
    return;
  }

  await sock.sendMessage(chatId, { text: tr.fetchFailed }, { quoted: message });
}

async function animuCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const tr = TR(chatId);

  try {
    await sock.sendMessage(chatId, { react: { text: tr.react, key: message.key } }).catch(() => {});
  } catch {}

  let subArg = Array.isArray(args) && args.length ? args[0] : '';
  if (!subArg) {
    const full = getTextFromMessage(message);
    subArg = full.split(/\s+/).slice(1).join(' ').trim();
  }

  const sub = normalizeType(subArg);
  const supported = ['nom', 'poke', 'cry', 'kiss', 'pat', 'hug', 'wink', 'face-palm', 'quote'];

  try {
    if (!sub) {
      try {
        const res = await axios.get(ANIMU_BASE, { timeout: 15000 });
        const apiTypes = res.data && Array.isArray(res.data.types)
          ? res.data.types.map((s) => String(s).replace('/animu/', '')).join(', ')
          : supported.join(', ');

        await sock.sendMessage(
          chatId,
          { text: `${tr.usage}\n\n${tr.typesLabel}\n${apiTypes}` },
          { quoted: message }
        );
      } catch {
        await sock.sendMessage(
          chatId,
          { text: `${tr.usage}\n\n${tr.typesLabel}\n${supported.join(', ')}` },
          { quoted: message }
        );
      }
      return;
    }

    if (!supported.includes(sub)) {
      await sock.sendMessage(
        chatId,
        { text: tr.unsupported(sub, supported.join(', ')) },
        { quoted: message }
      );
      return;
    }

    await sendAnimu(sock, chatId, message, sub);
  } catch (err) {
    console.error('[ANIMU] error:', err?.message || err);
    await sock.sendMessage(chatId, { text: tr.errorFetch }, { quoted: message });
  }
}

module.exports = {
  name: 'animu',
  aliases: ['animu', 'anime', 'انمي'],
  category: {
    en: '🖼️ Anime',
    ar: '🖼️ أنمي'
  },
  description: {
    ar: 'يرسل أنمي/ستيكّر حسب النوع (hug, kiss, pat, wink...).',
    en: 'Send anime media/sticker by type (hug, kiss, pat, wink...).'
  },
  usage: {
    ar: '.animu <النوع>',
    en: '.animu <type>'
  },
  emoji: '🌸',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: animuCommand,
  run: animuCommand,
  execute: animuCommand,
  animuCommand
};