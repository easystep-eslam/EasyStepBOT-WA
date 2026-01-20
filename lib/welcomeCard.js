const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'welcome.png');

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pickTextColor(lang) {
  // From your notes/screens: Arabic cyan tones, English white/yellow.
  return lang === 'ar' ? '#00E5FF' : '#FFFFFF';
}

function formatJoined(lang, date) {
  const iso = new Date(date || Date.now()).toISOString().slice(0, 10);
  return lang === 'ar' ? `انضم: ${iso}` : `Joined: ${iso}`;
}

async function buildWelcomeCard({
  lang,
  groupName,
  phoneNumber,
  joinedAt,
  avatarBuffer,
  templatePath,
  templateBuffer
}) {
  const template =
    templateBuffer && Buffer.isBuffer(templateBuffer) && templateBuffer.length
      ? templateBuffer
      : fs.readFileSync(templatePath || DEFAULT_TEMPLATE_PATH);

  const bg = sharp(template);
  const meta = await bg.metadata();
  const width = meta.width || 1024;
  const height = meta.height || 768;

  // Coordinates (from your screenshot):
  const AVATAR = { x: 80, y: 140, size: 220 };
  const TEXT = {
    x: 350,
    groupY: 210,
    phoneY: 260,
    joinedY: 310
  };

  // Avatar: circular mask 220x220
  let avatarPng = null;
  if (avatarBuffer && Buffer.isBuffer(avatarBuffer) && avatarBuffer.length) {
    const circleSvg = Buffer.from(
      `<svg width="${AVATAR.size}" height="${AVATAR.size}">` +
        `<circle cx="${AVATAR.size / 2}" cy="${AVATAR.size / 2}" r="${AVATAR.size / 2}" fill="white"/>` +
      `</svg>`
    );

    avatarPng = await sharp(avatarBuffer)
      .resize(AVATAR.size, AVATAR.size, { fit: 'cover' })
      .ensureAlpha()
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  const fill = pickTextColor(lang);

  // Text layer as SVG (Sharp will render it reliably)
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}">` +
      `<style>` +
        `.t1{font-family:Arial, sans-serif;font-size:54px;font-weight:700;fill:${fill};}` +
        `.t2{font-family:Arial, sans-serif;font-size:40px;font-weight:700;fill:${fill};}` +
        `.t3{font-family:Arial, sans-serif;font-size:36px;font-weight:700;fill:${fill};}` +
      `</style>` +
      `<text x="${TEXT.x}" y="${TEXT.groupY}" class="t1">${escapeXml(groupName || '')}</text>` +
      `<text x="${TEXT.x}" y="${TEXT.phoneY}" class="t2">${escapeXml(phoneNumber || '')}</text>` +
      `<text x="${TEXT.x}" y="${TEXT.joinedY}" class="t3">${escapeXml(formatJoined(lang, joinedAt))}</text>` +
    `</svg>`
  );

  const composites = [{ input: svg, top: 0, left: 0 }];
  if (avatarPng) composites.unshift({ input: avatarPng, top: AVATAR.y, left: AVATAR.x });

  return bg.composite(composites).jpeg({ quality: 92 }).toBuffer();
}

module.exports = { buildWelcomeCard, DEFAULT_TEMPLATE_PATH };
