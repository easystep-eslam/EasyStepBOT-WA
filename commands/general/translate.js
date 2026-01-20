const fetch = require('node-fetch');
const { getLang } = require('../../lib/lang');

function isValidLangCode(code) {
  // allow: en / ar / fr / es / zh / zh-cn / pt-br ... (2-8 with optional dash)
  return /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(String(code || '').trim());
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

async function translateCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const langGroup = getLang(chatId);

  const TXT = {
    en: {
      usage:
`*TRANSLATOR*
━━━━━━━━━━━━━━
Usage:
1) Reply to a message with: .translate <lang>
2) Or type: .translate <text> <lang>

Examples:
.translate hello fr
.translate مرحبا en

Notes:
• <lang> is target language code (e.g. en, ar, fr, es)
• Source language is auto-detected`,
      noText: '❌ No text found to translate. Please provide text or reply to a message.',
      noLang: '❌ Please provide target language code. Example: .translate hello ar',
      invalidLang: '❌ Invalid language code. Example: en, ar, fr, es',
      failed: '❌ Failed to translate text. Please try again later.'
    },
    ar: {
      usage:
`*المترجم*
━━━━━━━━━━━━━━
الاستخدام:
1) رد على رسالة واكتب: .translate <lang>
2) أو اكتب: .translate <text> <lang>

أمثلة:
.translate hello fr
.translate مرحبا en

ملاحظات:
• <lang> هو كود اللغة المطلوب (زي: en, ar, fr, es)
• اللغة الأصلية بتتحدد تلقائيًا`,
      noText: '❌ مفيش نص للترجمة. اكتب نص أو رد على رسالة.',
      noLang: '❌ لازم تكتب كود اللغة المطلوب. مثال: .translate hello ar',
      invalidLang: '❌ كود لغة غير صحيح. مثال: en, ar, fr, es',
      failed: '❌ فشلنا نترجم دلوقتي. جرّب تاني بعد شوية.'
    }
  };

  const T = TXT[langGroup] || TXT.en;

  // typing indicator
  try {
    await sock.presenceSubscribe(chatId);
    await sock.sendPresenceUpdate('composing', chatId);
  } catch {}

  try {
    // react مناسب للأمر
    try {
      await sock.sendMessage(chatId, { react: { text: '🌍', key: message.key } });
    } catch {}

    // raw after command comes from args OR fallback to parsing message text
    let raw = (args && args.length ? args.join(' ') : '').trim();

    // reply check
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    let textToTranslate = '';
    let targetLang = '';

    if (quotedMessage) {
      textToTranslate =
        quotedMessage.conversation ||
        quotedMessage.extendedTextMessage?.text ||
        quotedMessage.imageMessage?.caption ||
        quotedMessage.videoMessage?.caption ||
        '';

      targetLang = raw.trim();
    } else {
      // if args missing, fallback parse from message text (in case handler doesn't pass args)
      if (!raw) {
        const full = getTextFromMessage(message);
        raw = full.split(/\s+/).slice(1).join(' ').trim();
      }

      if (!raw) {
        await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
        return;
      }

      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
        return;
      }

      targetLang = parts.pop().trim();
      textToTranslate = parts.join(' ').trim();
    }

    if (!targetLang) {
      await sock.sendMessage(chatId, { text: T.noLang }, { quoted: message });
      return;
    }

    if (!isValidLangCode(targetLang)) {
      await sock.sendMessage(chatId, { text: T.invalidLang }, { quoted: message });
      return;
    }

    if (!textToTranslate) {
      await sock.sendMessage(chatId, { text: T.noText }, { quoted: message });
      return;
    }

    // Try multiple translation APIs in sequence
    let translatedText = null;

    // API 1: Google unofficial
    try {
      const r1 = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
          targetLang
        )}&dt=t&q=${encodeURIComponent(textToTranslate)}`
      );
      if (r1.ok) {
        const data = await r1.json();
        if (data?.[0]?.[0]?.[0]) translatedText = data[0][0][0];
      }
    } catch {}

    // API 2: MyMemory
    if (!translatedText) {
      try {
        const r2 = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            textToTranslate
          )}&langpair=auto|${encodeURIComponent(targetLang)}`
        );
        if (r2.ok) {
          const data = await r2.json();
          if (data?.responseData?.translatedText) translatedText = data.responseData.translatedText;
        }
      } catch {}
    }

    // API 3: dreaded.site
    if (!translatedText) {
      try {
        const r3 = await fetch(
          `https://api.dreaded.site/api/translate?text=${encodeURIComponent(
            textToTranslate
          )}&lang=${encodeURIComponent(targetLang)}`
        );
        if (r3.ok) {
          const data = await r3.json();
          if (data?.translated) translatedText = data.translated;
        }
      } catch {}
    }

    if (!translatedText) {
      await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: String(translatedText) }, { quoted: message });
  } catch (error) {
    console.error('❌ Error in translate command:', error);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  } finally {
    try {
      await sock.sendPresenceUpdate('paused', chatId);
    } catch {}
  }
}

module.exports = {
  name: 'translate',
  aliases: ['translate', 'trans', 'tr', 'مترجم', 'ترجمة', 'ترجم', 'ترجمه'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'ترجمة النص لأي لغة (مع اكتشاف تلقائي للغة الأصلية).',
    en: 'Translate text to any language (auto-detect source).'
  },
  usage: {
    ar: '.translate <text> <lang> | رد على رسالة بـ .translate <lang>',
    en: '.translate <text> <lang> | reply with .translate <lang>'
  },
  emoji: '🌐',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: translateCommand
};