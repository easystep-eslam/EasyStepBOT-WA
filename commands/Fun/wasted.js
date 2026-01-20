const axios = require("axios");
const { getLang } = require("../../lib/lang");

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key },
    });
  } catch {}
}

async function wastedCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      needTarget: "Please mention someone or reply to their message!",
      caption: (num) =>
        `⚰️ *Wasted* : ${num} 💀\n\nRest in peace.\n\nPowered by EasyStep`,
      failed: "Failed to create wasted image! Try again later.",
    },
    ar: {
      needTarget: "منشن حد أو اعمل رد على رسالته!",
      caption: (num) =>
        `⚰️ *Wasted* : ${num} 💀\n\nارقد بسلام.\n\nبواسطة EasyStep`,
      failed: "حصل خطأ ومقدرتش أعمل الصورة.. جرّب تاني بعد شوية.",
    },
  };

  const T = TXT[lang] || TXT.en;

  try {
    await react(sock, message, "⚰️");

    let userToWaste;

    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (Array.isArray(mentioned) && mentioned.length > 0) {
      userToWaste = mentioned[0];
    }

    if (!userToWaste) {
      const repliedParticipant =
        message.message?.extendedTextMessage?.contextInfo?.participant;
      if (repliedParticipant) userToWaste = repliedParticipant;
    }

    if (!userToWaste) {
      await sock.sendMessage(chatId, { text: T.needTarget }, { quoted: message });
      await react(sock, message, "❌");
      return;
    }

    const url = `https://some-random-api.com/canvas/wasted?avatar=${encodeURIComponent(
      `https://api.dicebear.com/6.x/identicon/png?seed=${userToWaste}`
    )}`;

    const res = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(res.data);

    const num = Math.floor(Math.random() * 100) + 1;

    await sock.sendMessage(
      chatId,
      {
        image: buffer,
        caption: T.caption(num),
      },
      { quoted: message }
    );

    await react(sock, message, "✅");
  } catch {
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
    await react(sock, message, "❌");
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: "wasted",
  aliases: ["rip", "مطلوب"],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  emoji: "🪦",
  description: {
    ar: "إنشاء صورة Wasted ساخرة لعضو عن طريق المنشن أو الرد على رسالته.",
    en: "Create a funny Wasted image for a member by mention or reply.",
  },
  exec: wastedCommand,
  run: wastedCommand,
  execute: wastedCommand,
};