const { spawn } = require('child_process');
const fs = require('fs');
const { writeExifVid } = require('../../lib/exif');
const { getLang } = require('../../lib/lang');

async function safeReact(sock, chatId, message, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
  } catch {}
}

function renderBlinkingVideoWithFfmpeg(text) {
  return new Promise((resolve, reject) => {
    const fontPath =
      process.platform === 'win32'
        ? 'C:/Windows/Fonts/arialbd.ttf'
        : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

    const escapeDrawtextText = (s) =>
      String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/,/g, '\\,')
        .replace(/'/g, "\\'")
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/%/g, '\\%');

    const safeText = escapeDrawtextText(text);
    const safeFontPath =
      process.platform === 'win32'
        ? fontPath.replace(/\\/g, '/').replace(':', '\\:')
        : fontPath;

    const cycle = 0.3;
    const dur = 1.8;

    const drawRed = `drawtext=fontfile='${safeFontPath}':text='${safeText}':fontcolor=red:borderw=2:bordercolor=black@0.6:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2:enable='lt(mod(t\\,${cycle})\\,0.1)'`;
    const drawBlue = `drawtext=fontfile='${safeFontPath}':text='${safeText}':fontcolor=blue:borderw=2:bordercolor=black@0.6:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(mod(t\\,${cycle})\\,0.1\\,0.2)'`;
    const drawGreen = `drawtext=fontfile='${safeFontPath}':text='${safeText}':fontcolor=green:borderw=2:bordercolor=black@0.6:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2:enable='gte(mod(t\\,${cycle})\\,0.2)'`;

    const filter = `${drawRed},${drawBlue},${drawGreen}`;

    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=black:s=512x512:d=${dur}:r=20`,
      '-vf', filter,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart+frag_keyframe+empty_moov',
      '-t', String(dur),
      '-f', 'mp4',
      'pipe:1'
    ];

    const ff = spawn('ffmpeg', args);
    const chunks = [];
    const errors = [];

    ff.stdout.on('data', (d) => chunks.push(d));
    ff.stderr.on('data', (e) => errors.push(e));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(chunks));
      reject(new Error(Buffer.concat(errors).toString() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function attpCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      usage:
        'Usage:\n.attp <text>\n\nExample:\n.attp EasyStep',
      noText: '❌ Please provide text after the command.\nExample: .attp EasyStep',
      failed: '❌ Failed to generate the sticker.',
    },
    ar: {
      usage:
        'طريقة الاستخدام:\n.attp <نص>\n\nمثال:\n.attp EasyStep',
      noText: '❌ من فضلك اكتب نص بعد الأمر.\nمثال: .attp EasyStep',
      failed: '❌ فشل إنشاء الاستيكر.',
    }
  };

  const T = TXT[lang] || TXT.en;

  const rawText =
    message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() ||
    '';

  const text =
    (Array.isArray(args) && args.length ? args.join(' ') : rawText.split(/\s+/).slice(1).join(' '))
      .trim();

  if (!text) {
    await safeReact(sock, chatId, message, '❓');
    await sock.sendMessage(chatId, { text: T.noText + '\n\n' + T.usage }, { quoted: message });
    return;
  }

  await safeReact(sock, chatId, message, '🎨');

  try {
    const mp4Buffer = await renderBlinkingVideoWithFfmpeg(text);
    const webpPath = await writeExifVid(mp4Buffer, { packname: 'EasyStep Bot' });

    const webpBuffer = fs.readFileSync(webpPath);
    try { fs.unlinkSync(webpPath); } catch (_) {}

    await sock.sendMessage(chatId, { sticker: webpBuffer }, { quoted: message });
    await safeReact(sock, chatId, message, '✅');
  } catch (error) {
    console.error('Error generating local sticker:', error);
    await safeReact(sock, chatId, message, '⚠️');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'attp',
  aliases: ['ستيكر_نص', 'نص_ستيكر'],
  category: {
    ar: '🎨 أوامر الصور والستيكر',
    en: '🎨 Image & Sticker Commands'
  },
  description: {
    ar: 'عمل ستيكر متحرك من نص.',
    en: 'Create an animated text sticker.'
  },
  usage: {
    ar: '.attp <نص>',
    en: '.attp <text>'
  },
  emoji: '🎞️📝',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: attpCommand
};