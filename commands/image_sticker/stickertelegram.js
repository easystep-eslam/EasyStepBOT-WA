const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');

const settings = require('../../settings');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function extractText(message) {
  return (
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    ''
  );
}

function isTelegramStickerPackUrl(url) {
  return /^https:\/\/t\.me\/addstickers\/[A-Za-z0-9_]+$/i.test(url);
}

async function stickerTelegramExec(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      ownerOnly: '❌ Owner/Sudo only.',
      needUrl:
        '⚠️ Please enter a Telegram sticker pack URL.\nExample:\n.tg https://t.me/addstickers/Porcientoreal',
      badUrl: '❌ Invalid URL.\nIt must look like:\nhttps://t.me/addstickers/<packName>',
      noToken: '❌ TG_BOT_TOKEN is not set in environment variables.',
      found: (n) => `📦 Found ${n} stickers.\n⏳ Starting download...`,
      skipTgs: '⚠️ Some stickers are .tgs (animated) and will be skipped (unsupported).',
      done: (ok, total) => `✅ Done: ${ok}/${total} stickers sent.`,
      failed:
        '❌ Failed to process Telegram stickers.\nMake sure:\n1) URL is correct\n2) pack exists\n3) pack is public'
    },
    ar: {
      ownerOnly: '❌ الأمر ده للأونر/سودو بس.',
      needUrl:
        '⚠️ ابعت رابط باك ستيكرات تيليجرام.\nمثال:\n.tg https://t.me/addstickers/Porcientoreal',
      badUrl:
        '❌ الرابط غير صحيح.\nلازم يكون بالشكل ده:\nhttps://t.me/addstickers/<packName>',
      noToken: '❌ متغير TG_BOT_TOKEN مش موجود في env.',
      found: (n) => `📦 لقينا ${n} ستيكر.\n⏳ جاري التحميل...`,
      skipTgs: '⚠️ في ستيكرات .tgs (متحركة) هتتعمل Skip (غير مدعومة).',
      done: (ok, total) => `✅ تم الإرسال: ${ok}/${total} ستيكر.`,
      failed:
        '❌ فشل تحميل ستيكرات تيليجرام.\nاتأكد من:\n1) الرابط صحيح\n2) الباك موجود\n3) الباك Public'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    const senderId = message.key.participant || message.key.remoteJid;
    const okOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!okOwner) {
      await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });
      return;
    }

    const raw = extractText(message);
    const cmdToken = (raw.trim().split(/\s+/)[0] || '.tg').trim();
    const input = (args?.length ? args.join(' ') : raw.slice(cmdToken.length)).trim();

    if (!input) {
      await sock.sendMessage(chatId, { text: T.needUrl }, { quoted: message });
      return;
    }

    if (!isTelegramStickerPackUrl(input)) {
      await sock.sendMessage(chatId, { text: T.badUrl }, { quoted: message });
      return;
    }

    const botToken = process.env.TG_BOT_TOKEN;
    if (!botToken) {
      await sock.sendMessage(chatId, { text: T.noToken }, { quoted: message });
      return;
    }

    const packName = input.replace('https://t.me/addstickers/', '').trim();

    const r1 = await fetch(
      `https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(packName)}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r1.ok) throw new Error(`getStickerSet HTTP ${r1.status}`);

    const stickerSet = await r1.json();
    if (!stickerSet.ok || !stickerSet.result?.stickers?.length) throw new Error('Invalid sticker pack');

    const stickers = stickerSet.result.stickers;

    await sock.sendMessage(chatId, { text: T.found(stickers.length) }, { quoted: message });

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    let successCount = 0;
    let warnedTgs = false;

    for (let i = 0; i < stickers.length; i++) {
      const sticker = stickers[i];

      try {
        const r2 = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(sticker.file_id)}`,
          { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!r2.ok) continue;

        const fileData = await r2.json();
        const filePath = fileData?.result?.file_path;
        if (!filePath) continue;

        if (filePath.endsWith('.tgs')) {
          if (!warnedTgs) {
            warnedTgs = true;
            await sock.sendMessage(chatId, { text: T.skipTgs }, { quoted: message });
          }
          continue;
        }

        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
        const r3 = await fetch(fileUrl, { headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' } });
        if (!r3.ok) continue;

        const inputBuffer = await r3.buffer();
        if (!inputBuffer?.length) continue;

        const stamp = `${Date.now()}_${i}`;
        const tempInput = path.join(tmpDir, `tg_${stamp}.bin`);
        const tempOutput = path.join(tmpDir, `tg_${stamp}.webp`);

        fs.writeFileSync(tempInput, inputBuffer);

        const isAnimated = !!sticker.is_animated || !!sticker.is_video || filePath.endsWith('.webm');

        const ffmpegCommand = isAnimated
          ? `ffmpeg -y -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`
          : `ffmpeg -y -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;

        await new Promise((resolve, reject) => {
          exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
        });

        if (!fs.existsSync(tempOutput)) throw new Error('ffmpeg output missing');

        const webpBuffer = fs.readFileSync(tempOutput);

        const img = new webp.Image();
        await img.load(webpBuffer);

        const metadata = {
          'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
          'sticker-pack-name': settings.packname || 'EasyStep',
          emojis: sticker.emoji ? [sticker.emoji] : ['🤖']
        };

        const exifAttr = Buffer.from([
          0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
          0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ]);

        const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);

        img.exif = exif;
        const finalBuffer = await img.save(null);

        await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });

        successCount++;
        await delay(900);

        try { fs.unlinkSync(tempInput); } catch {}
        try { fs.unlinkSync(tempOutput); } catch {}

      } catch (e) {
        console.error(`TG sticker ${i} error:`, e?.message || e);
      }
    }

    await sock.sendMessage(chatId, { text: T.done(successCount, stickers.length) }, { quoted: message });

  } catch (error) {
    console.error('Error in tg command:', error?.message || error);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'tg',
  aliases: ['tg', 'telegramsticker', 'tgs', 'تيليجرام', 'ستيكرات_تيليجرام', 'ملصقات_تيليجرام'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'تحميل باك ستيكرات تيليجرام وإرسالها كستيكرات واتساب.',
    en: 'Download a Telegram sticker pack and send it as WhatsApp stickers.'
  },
  usage: {
    ar: '.tg https://t.me/addstickers/<packName>',
    en: '.tg https://t.me/addstickers/<packName>'
  },
  emoji: '🧩',
  admin: false,
  owner: true,
  showInMenu: true,

  exec: stickerTelegramExec,
  run: stickerTelegramExec,
  execute: stickerTelegramExec
};