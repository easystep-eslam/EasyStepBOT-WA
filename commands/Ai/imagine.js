const axios = require('axios');
const { getLang } = require('../../lib/lang');

/*
📝 Command Info
────────────────
Name      : imagine
Aliases   : imagine , img
Category  : 🤖 AI Commands | 🤖 أوامر الذكاء الاصطناعي

Usage:
• .imagine <prompt>
• .img <prompt>

Notes:
• React is required ✅
• Supports AR/EN based on group language ✅
• Metadata at the end ✅
• No extra comments inside logic ✅
*/

const TXT = {
  en: {
    noPrompt:
      'Please provide a prompt for image generation.\nExample: .imagine a beautiful sunset over mountains',
    wait: '🎨 Generating your image... Please wait.',
    failed: '❌ Failed to generate image. Please try again later.',
    caption: (p) => `🎨 Generated image for prompt: "${p}"`
  },
  ar: {
    noPrompt: 'من فضلك اكتب وصف للصورة.\nمثال: .imagine غروب جميل فوق الجبال',
    wait: '🎨 جاري توليد الصورة... انتظر قليلاً.',
    failed: '❌ فشل توليد الصورة. جرّب تاني بعد شوية.',
    caption: (p) => `🎨 تم توليد الصورة للوصف: "${p}"`
  }
};

function enhancePrompt(prompt) {
  const qualityEnhancers = [
    'high quality',
    'detailed',
    'masterpiece',
    'best quality',
    'ultra realistic',
    '4k',
    'highly detailed',
    'professional photography',
    'cinematic lighting',
    'sharp focus'
  ];

  const shuffled = qualityEnhancers.slice().sort(() => Math.random() - 0.5);
  const numEnhancers = Math.floor(Math.random() * 2) + 3;
  const selected = shuffled.slice(0, numEnhancers);

  const clean = String(prompt || '').trim().replace(/\s+/g, ' ');
  return `${clean}, ${selected.join(', ')}`;
}

async function imagineCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);
  const T = TXT[lang] || TXT.en;

  const imagePrompt = (args || []).join(' ').trim();
  if (!imagePrompt) {
    await sock.sendMessage(chatId, { text: T.noPrompt }, { quoted: message });
    return;
  }

  try {
    await sock.sendMessage(chatId, { react: { text: '🎨', key: message.key } }).catch(() => {});
  } catch {}

  await sock.sendMessage(chatId, { text: T.wait }, { quoted: message });

  try {
    const enhancedPrompt = enhancePrompt(imagePrompt);

    const response = await axios.get(
      `https://shizoapi.onrender.com/api/ai/imagine?apikey=shizo&query=${encodeURIComponent(enhancedPrompt)}`,
      { responseType: 'arraybuffer', timeout: 60000 }
    );

    const imageBuffer = Buffer.from(response.data);

    await sock.sendMessage(
      chatId,
      {
        image: imageBuffer,
        caption: T.caption(imagePrompt)
      },
      { quoted: message }
    );
  } catch (err) {
    console.error('[IMAGINE]', err?.message || err);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'imagine',
  aliases: ['توليد', 'img'],
  category: {
    en: '🤖 AI Commands',
    ar: '🤖 أوامر الذكاء الاصطناعي'
  },
  description: {
    en: 'Generate an image from a prompt.',
    ar: 'توليد صورة من وصف (Prompt).'
  },
  usage: {
    en: '.imagine <prompt>',
    ar: '.imagine <وصف>'
  },
  emoji: '🎨',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: imagineCommand,
  run: imagineCommand,
  execute: imagineCommand,
  imagineCommand
};