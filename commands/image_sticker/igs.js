const { igdl } = require('ruhend-scraper');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');

const settings = require('../../settings');
const { getLang } = require('../../lib/lang');
const { stickercropFromBuffer } = require('./stickercrop');

async function safeReact(sock, chatId, message, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
  } catch {}
}

async function convertBufferToStickerWebp(inputBuffer, isAnimated, cropSquare) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const tempInputBase = path.join(tmpDir, `igs_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const tempInput = isAnimated ? `${tempInputBase}.mp4` : `${tempInputBase}.jpg`;
  const tempOutput = path.join(tmpDir, `igs_out_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);

  fs.writeFileSync(tempInput, inputBuffer);

  const scheduleDelete = (p) => {
    if (!p) return;
    setTimeout(() => {
      try { fs.unlinkSync(p); } catch {}
    }, 5000);
  };

  const vfCropSquareImg = "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512";
  const vfPadSquareImg = "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000";

  let ffmpegCommand;
  if (isAnimated) {
    const isLargeVideo = inputBuffer.length > (5 * 1024 * 1024);
    if (cropSquare) {
      ffmpegCommand = isLargeVideo
        ? `ffmpeg -y -i "${tempInput}" -t 2 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 30 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput}"`
        : `ffmpeg -y -i "${tempInput}" -t 3 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=12" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 50 -compression_level 6 -b:v 150k -max_muxing_queue_size 1024 "${tempOutput}"`;
    } else {
      ffmpegCommand = isLargeVideo
        ? `ffmpeg -y -i "${tempInput}" -t 2 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 35 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput}"`
        : `ffmpeg -y -i "${tempInput}" -t 3 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=12" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 45 -compression_level 6 -b:v 150k -max_muxing_queue_size 1024 "${tempOutput}"`;
    }
  } else {
    const vf = `${cropSquare ? vfCropSquareImg : vfPadSquareImg},format=rgba`;
    ffmpegCommand = `ffmpeg -y -i "${tempInput}" -vf "${vf}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
  }

  await new Promise((resolve, reject) => {
    exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
  });

  let webpBuffer = fs.readFileSync(tempOutput);
  scheduleDelete(tempOutput);

  if (isAnimated && webpBuffer.length > 1000 * 1024) {
    try {
      const tempOutput2 = path.join(tmpDir, `igs_out2_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
      const harsherCmd = cropSquare
        ? `ffmpeg -y -i "${tempInput}" -t 2 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 30 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput2}"`
        : `ffmpeg -y -i "${tempInput}" -t 2 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 35 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput2}"`;

      await new Promise((resolve, reject) => {
        exec(harsherCmd, (error) => (error ? reject(error) : resolve()));
      });

      if (fs.existsSync(tempOutput2)) {
        webpBuffer = fs.readFileSync(tempOutput2);
        scheduleDelete(tempOutput2);
      }
    } catch {}
  }

  const img = new webp.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': settings.packname || 'KnightBot',
    emojis: ['📸']
  };

  const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  img.exif = exif;

  let finalBuffer = await img.save(null);

  if (finalBuffer.length > 900 * 1024) {
    try {
      const tempOutput3 = path.join(tmpDir, `igs_out3_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
      const vfSmall = cropSquare
        ? `crop=min(iw\\,ih):min(iw\\,ih),scale=320:320${isAnimated ? ',fps=8' : ''}`
        : `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=#00000000${isAnimated ? ',fps=8' : ''}`;

      const cmdSmall = `ffmpeg -y -i "${tempInput}" ${isAnimated ? '-t 2' : ''} -vf "${vfSmall}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality ${isAnimated ? 28 : 65} -compression_level 6 -b:v 80k -max_muxing_queue_size 1024 "${tempOutput3}"`;

      await new Promise((resolve, reject) => {
        exec(cmdSmall, (error) => (error ? reject(error) : resolve()));
      });

      if (fs.existsSync(tempOutput3)) {
        const smallWebp = fs.readFileSync(tempOutput3);
        const img2 = new webp.Image();
        await img2.load(smallWebp);

        const json2 = {
          'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
          'sticker-pack-name': settings.packname || 'KnightBot',
          emojis: ['📸']
        };

        const exifAttr2 = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
        const jsonBuffer2 = Buffer.from(JSON.stringify(json2), 'utf8');
        const exif2 = Buffer.concat([exifAttr2, jsonBuffer2]);
        exif2.writeUIntLE(jsonBuffer2.length, 14, 4);
        img2.exif = exif2;

        finalBuffer = await img2.save(null);
        scheduleDelete(tempOutput3);
      }
    } catch {}
  }

  scheduleDelete(tempInput);
  return finalBuffer;
}

async function fetchBufferFromUrl(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Encoding': 'identity' },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      decompress: true,
      validateStatus: (s) => s >= 200 && s < 400
    });
    return Buffer.from(res.data);
  } catch (e1) {
    try {
      const res = await axios.get(url, {
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Encoding': 'identity' },
        timeout: 40000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (s) => s >= 200 && s < 400
      });

      const chunks = [];
      await new Promise((resolve, reject) => {
        res.data.on('data', (c) => chunks.push(c));
        res.data.on('end', resolve);
        res.data.on('error', reject);
      });
      return Buffer.concat(chunks);
    } catch (e2) {
      console.error('Both axios download attempts failed:', e1?.message || e1, e2?.message || e2);
      throw e2;
    }
  }
}

async function forceMiniSticker(inputBuffer, isVideo, cropSquare) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const tempInput = path.join(tmpDir, `mini_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`);
  const tempOutput = path.join(tmpDir, `mini_out_${Date.now()}.webp`);
  fs.writeFileSync(tempInput, inputBuffer);

  const vf = cropSquare
    ? `crop=min(iw\\,ih):min(iw\\,ih),scale=256:256${isVideo ? ',fps=6' : ''}`
    : `scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=#00000000${isVideo ? ',fps=6' : ''}`;

  const cmd = `ffmpeg -y -i "${tempInput}" ${isVideo ? '-t 2' : ''} -vf "${vf}" -c:v libwebp -preset default -loop 0 -pix_fmt yuva420p -quality 25 -compression_level 6 -b:v 60k "${tempOutput}"`;

  await new Promise((resolve, reject) => {
    exec(cmd, (error) => (error ? reject(error) : resolve()));
  });

  if (!fs.existsSync(tempOutput)) {
    try { fs.unlinkSync(tempInput); } catch {}
    return null;
  }

  const smallWebp = fs.readFileSync(tempOutput);

  const img = new webp.Image();
  await img.load(smallWebp);

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': settings.packname || 'KnightBot',
    emojis: ['📸']
  };

  const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  img.exif = exif;

  const finalBuffer = await img.save(null);

  try { fs.unlinkSync(tempInput); } catch {}
  try { fs.unlinkSync(tempOutput); } catch {}

  return finalBuffer;
}

async function handleIgs(sock, message, args, crop) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage: 'Usage:\n.igs <url>\n.igsc <url>',
      needUrl: 'Send an Instagram post/reel link.\nUsage:\n.igs <url>\n.igsc <url>',
      failedFetch: '❌ Failed to fetch media from Instagram link.',
      noMedia: '❌ No media found at the provided link.'
    },
    ar: {
      usage: 'طريقة الاستخدام:\n.igs <url>\n.igsc <url>',
      needUrl: 'ابعت لينك انستجرام (بوست/ريل).\nالاستخدام:\n.igs <url>\n.igsc <url>',
      failedFetch: '❌ فشل تحميل الميديا من لينك انستجرام.',
      noMedia: '❌ مفيش ميديا في اللينك ده.'
    }
  };

  const T = TXT[lang] || TXT.en;

  const url = (args || []).find((a) => /^https?:\/\//i.test(String(a))) || '';

  if (!url) {
    await safeReact(sock, chatId, message, '❓');
    await sock.sendMessage(chatId, { text: `${T.needUrl}\n\n${T.usage}` }, { quoted: message });
    return;
  }

  await safeReact(sock, chatId, message, '🔄');

  const downloadData = await igdl(url).catch(() => null);
  if (!downloadData || !downloadData.data) {
    await safeReact(sock, chatId, message, '⚠️');
    await sock.sendMessage(chatId, { text: T.failedFetch }, { quoted: message });
    return;
  }

  const rawItems = (downloadData.data || []).filter((m) => m && m.url);

  const seenUrls = new Set();
  const items = [];
  for (const m of rawItems) {
    if (!seenUrls.has(m.url)) {
      seenUrls.add(m.url);
      items.push(m);
    }
  }

  if (items.length === 0) {
    await safeReact(sock, chatId, message, '⚠️');
    await sock.sendMessage(chatId, { text: T.noMedia }, { quoted: message });
    return;
  }

  const maxItems = Math.min(items.length, 10);
  const seenHashes = new Set();

  for (let i = 0; i < maxItems; i++) {
    try {
      const media = items[i];
      const mediaUrl = media.url;
      const isVideo = (media?.type === 'video') || /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl);

      const buffer = await fetchBufferFromUrl(mediaUrl);

      const hash = crypto.createHash('sha1').update(buffer).digest('hex');
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);

      const stickerBuffer = crop
        ? await stickercropFromBuffer(buffer, isVideo)
        : await convertBufferToStickerWebp(buffer, isVideo, false);

      let finalSticker = stickerBuffer;
      if (finalSticker.length > 900 * 1024) {
        try {
          const fallback = await forceMiniSticker(buffer, isVideo, crop);
          if (fallback && fallback.length <= 900 * 1024) finalSticker = fallback;
        } catch {}
      }

      await sock.sendMessage(chatId, { sticker: finalSticker }, { quoted: message });

      if (i < maxItems - 1) await new Promise((r) => setTimeout(r, 800));
    } catch (perItemErr) {
      console.error('IGS item error:', perItemErr);
    }
  }

  await safeReact(sock, chatId, message, '✅');
}

async function igsCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;

  const raw =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    '';

  const first = String(raw || '').trim().split(/\s+/)[0] || '';
  const cmd = first.replace(/^\./, '').toLowerCase();

  const crop = cmd === 'igsc' || cmd === 'igscrop';

  return handleIgs(sock, message, args, crop);
}

module.exports = {
  name: 'igs',
  aliases: ['igsc', 'insta', 'insticker'],
  category: {

    ar: '🎨 أوامر الصور والستيكر',

    en: '🎨 Image & Sticker Commands'

  },
  description: {
    ar: 'تحميل محتوى انستجرام وتحويله لستيكر (بوست/ريل).',
    en: 'Download Instagram media and convert to sticker (post/reel).'
  },
  usage: {
    ar: '.igs <url>\n.igsc <url>',
    en: '.igs <url>\n.igsc <url>'
  },
  emoji: '📸🏷️',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: igsCommand
};