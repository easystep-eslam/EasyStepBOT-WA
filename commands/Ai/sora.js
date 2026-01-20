const axios = require('axios');
const { getLang } = require('../../lib/lang');

const TXT = {
  en: {
    usage: 'Provide a prompt.\nExample:\n.sora anime girl with short blue hair',
    wait: '🎬 Generating your video... Please wait.',
    failed: '❌ Failed to generate video. Try a different prompt later.',
    caption: (p) => `🎬 Prompt:\n${p}`
  },
  ar: {
    usage: 'اكتب وصف للفيديو 🎬\nمثال:\n.sora بنت انمي بشعر أزرق قصير',
    wait: '🎬 جاري إنشاء الفيديو... انتظر قليلاً.',
    failed: '❌ فشل إنشاء الفيديو، جرّب وصف مختلف بعد شوية.',
    caption: (p) => `🎬 الوصف:\n${p}`
  }
};

function getTextFromMessage(msg) {
  return (
    msg?.message?.conversation?.trim() ||
    msg?.message?.extendedTextMessage?.text?.trim() ||
    msg?.message?.imageMessage?.caption?.trim() ||
    msg?.message?.videoMessage?.caption?.trim() ||
    ''
  );
}

function getQuotedText(message) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  return (
    quoted?.conversation?.trim() ||
    quoted?.extendedTextMessage?.text?.trim() ||
    quoted?.imageMessage?.caption?.trim() ||
    quoted?.videoMessage?.caption?.trim() ||
    ''
  );
}

/*
📝 Command Info
────────────────
Name      : sora
Aliases   : sora , txt2video , videoai , سورا , فيديو , تحويل_لفيديو
Category  : 🤖 AI Commands | 🤖 أوامر الذكاء الاصطناعي

Usage:
• .sora <prompt>
• Reply to a message and type: .sora
• .txt2video <prompt>

Notes:
• React required ✅
• Supports AR/EN ✅
• Metadata at the end ✅
• No extra comments inside logic ✅
*/

async function soraCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);
  const T = TXT[lang] || TXT.en;

  try {
    await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } }).catch(() => {});
  } catch {}

  const argsText = (args || []).join(' ').trim();

  let input = argsText;
  if (!input) input = getQuotedText(message);
  if (!input) {
    const full = getTextFromMessage(message);
    input = full.split(/\s+/).slice(1).join(' ').trim();
  }

  if (!input) {
    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
    return;
  }

  await sock.sendMessage(chatId, { text: T.wait }, { quoted: message });

  try {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(input)}`;
    const { data } = await axios.get(apiUrl, {
      timeout: 60000,
      headers: { 'user-agent': 'Mozilla/5.0' }
    });

    const videoUrl = data?.videoUrl || data?.result || data?.data?.videoUrl;
    if (!videoUrl) throw new Error('No videoUrl in API response');

    await sock.sendMessage(
      chatId,
      {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption: T.caption(input)
      },
      { quoted: message }
    );
  } catch (error) {
    console.error('[SORA]', error?.message || error);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'sora',
  aliases: ['sora', 'txt2video', 'videoai', 'سورا', 'فيديو', 'تحويل_لفيديو'],
  category: {
    ar: '🤖 أوامر الذكاء الاصطناعي',
    en: '🤖 AI Commands'
  },
  description: {
    ar: 'تحويل وصف (Prompt) إلى فيديو.',
    en: 'Generate a video from a text prompt.'
  },
  usage: {
    ar: '.sora <وصف>',
    en: '.sora <prompt>'
  },
  emoji: '🖼️',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: soraCommand,
  run: soraCommand,
  execute: soraCommand,
  soraCommand
};