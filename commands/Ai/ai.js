const axios = require('axios');
const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

/*
📝 Command Info
────────────────
Name      : ai
Aliases   : gpt, gemini, شات, جي_بي_تي, جيميني
Category  : 🤖 AI Commands | 🤖 أوامر الذكاء الاصطناعي

Usage:
• .gpt <question>
• .gemini <question>

Notes:
• React is sent on every run ✅
• Works Arabic/English based on group language ✅
• No comments inside logic (per your golden rule add-on) ✅
*/

const TXT = {
  en: {
    react: '🤖',
    noQuery: "Please write your question.\n\nExample:\n.gpt write a basic html code",
    failed: "❌ Failed to get response. Please try again later.",
    error: "❌ An error occurred. Please try again later.",
    busy: "⏳ Please wait a moment and try again."
  },
  ar: {
    react: '🤖',
    noQuery: "من فضلك اكتب سؤالك.\n\nمثال:\n.gpt اكتب كود HTML بسيط",
    failed: "❌ حصلت مشكلة في الرد. جرّب تاني بعد شوية.",
    error: "❌ حصل خطأ. جرّب تاني بعد شوية.",
    busy: "⏳ استنى لحظة وجرب تاني."
  }
};

function getRawText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  );
}

function pickAnswer(data) {
  return (
    data?.message ||
    data?.data ||
    data?.answer ||
    data?.result ||
    data?.response ||
    data?.text ||
    null
  );
}

async function aiCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);
  const T = TXT[lang] || TXT.en;

  try {
    await sock.sendMessage(chatId, { react: { text: T.react, key: message.key } }).catch(() => {});
  } catch {}

  const rawText = getRawText(message);
  const firstWord = (rawText.trim().split(/\s+/)[0] || '').toLowerCase().replace(/^\./, '');
  const query = (args || []).join(' ').trim();

  if (!query) {
    await sock.sendMessage(chatId, { text: T.noQuery }, { quoted: message });
    return;
  }

  const isGpt = ['gpt', 'شات', 'جي_بي_تي'].includes(firstWord);
  const isGemini = ['gemini', 'جيميني'].includes(firstWord);

  try {
    if (isGpt) {
      const response = await axios.get(
        `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`,
        { timeout: 20000 }
      );

      const answer = pickAnswer(response?.data);
      if (!answer) throw new Error('Invalid response from GPT API');

      await sock.sendMessage(chatId, { text: String(answer) }, { quoted: message });
      return;
    }

    if (isGemini) {
      const apis = [
        `https://vapis.my.id/api/gemini?q=${encodeURIComponent(query)}`,
        `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(query)}`,
        `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(query)}`,
        `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`,
        `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(query)}`,
        `https://api.giftedtech.my.id/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(query)}`
      ];

      for (const api of apis) {
        try {
          const r = await fetch(api, { timeout: 20000 }).catch(() => null);
          if (!r || !r.ok) continue;

          const data = await r.json().catch(() => ({}));
          const answer = pickAnswer(data);

          if (answer) {
            await sock.sendMessage(chatId, { text: String(answer) }, { quoted: message });
            return;
          }
        } catch {}
      }

      await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: T.noQuery }, { quoted: message });
  } catch (err) {
    console.error('[AI]', err?.stack || err);
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

module.exports = {
  name: 'ai',
  aliases: ['gpt', 'gemini', 'شات', 'جي_بي_تي', 'جيميني'],
  category: {
    en: '🤖 AI Commands',
    ar: '🤖 أوامر الذكاء الاصطناعي'
  },
  description: {
    en: 'Ask GPT or Gemini based on the used command (.gpt / .gemini).',
    ar: 'اسأل GPT أو Gemini حسب الأمر المستخدم (.gpt / .gemini).'
  },
  usage: {
    en: '.gpt <question>\n.gemini <question>',
    ar: '.gpt <سؤال>\n.gemini <سؤال>'
  },
  emoji: '🧠',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: aiCommand,
  run: aiCommand,
  execute: aiCommand,
  aiCommand
};