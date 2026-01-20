const { getLang } = require('../../lib/lang');

/* ================= WORD LISTS ================= */

const wordsEn = [
  'javascript','whatsapp','hangman','computer','programming','developer','function','variable',
  'database','internet','application','telegram','facebook','instagram','twitter','algorithm',
  'software','hardware','keyboard','monitor','mobile','android','iphone','windows','linux',
  'network','security','encryption','server','client','browser','website','command','terminal',
  'message','picture','sticker','document','download','upload','language','project','github',
  'opensource'
];

const wordsAr = [
  'مشنقة','برمجة','واتساب','بوت','ذكاء','تطبيق','مفتاح','شاشة','رسالة','جروب',
  'مشرف','نظام','ملف','صورة','صوت','تحميل','رفع','مشاركة','رابط','أمان',
  'شبكة','انترنت','هاتف','كمبيوتر','لوحة','مجلد','برنامج','خادم','مستخدم','إعدادات',
  'أوامر','لعبة','ترفيه','معلومة','حساب','كلمة','مرور','تشغيل','إيقاف','محادثة',
  'موقع','تحديث','نسخة','دخول','خروج','تنزيل','تنظيف','تحكم','إدارة','ذكريات'
];

/* ================= GAME STORAGE ================= */

const hangmanGames = {};

/* ================= HELPERS ================= */

function maskWord(word) {
  return Array.from({ length: word.length }, () => '_');
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTexts(lang) {
  const TXT = {
    en: {
      chooseLang:
        `🎮 *Hangman Game*\n\n` +
        `1️⃣ Arabic\n` +
        `2️⃣ English\n\n` +
        `✍️ Reply with *1* or *2* (60s)`,
      chooseTimeout: '⏳ Time is up. Start again with: .hangman',
      started: (m) => `🎮 Game started!\nWord: ${m}`,
      already: '⚠️ A game is already running in this group.',
      noGame: '❌ No game running.\nStart with: .hangman',
      invalidLetter: '❌ Guess ONE letter only.',
      repeated: (l) => `⚠️ You already guessed "${l}"`,
      correct: (m) => `✅ Correct!\n${m}`,
      wrong: (l) => `❌ Wrong!\nTries left: ${l}`,
      win: (w) => `🎉 You won!\nWord was: ${w}`,
      lose: (w) => `💀 Game over!\nWord was: ${w}`,
      state: (m, w, max, g) =>
        `Word: ${m}\nWrong: ${w}/${max}\nGuessed: ${g || '-'}`,
      tip: '✍️ Send a letter directly (no command).'
    },
    ar: {
      chooseLang:
        `🎮 *لعبة المشنقة*\n\n` +
        `1️⃣ عربي\n` +
        `2️⃣ English\n\n` +
        `✍️ اكتب *1* أو *2* (60 ثانية)`,
      chooseTimeout: '⏳ انتهى الوقت. ابدأ من جديد بـ: .hangman',
      started: (m) => `🎮 بدأت اللعبة!\nالكلمة: ${m}`,
      already: '⚠️ في لعبة شغالة بالفعل في الجروب.',
      noGame: '❌ مفيش لعبة شغالة.\nابدأ بـ: .hangman',
      invalidLetter: '❌ اكتب حرف واحد بس.',
      repeated: (l) => `⚠️ الحرف "${l}" متخمن قبل كده`,
      correct: (m) => `✅ صح!\n${m}`,
      wrong: (l) => `❌ غلط!\nمحاولات متبقية: ${l}`,
      win: (w) => `🎉 مبروك! الكلمة كانت: ${w}`,
      lose: (w) => `💀 اللعبة انتهت.\nالكلمة كانت: ${w}`,
      state: (m, w, max, g) =>
        `الكلمة: ${m}\nأخطاء: ${w}/${max}\nالحروف: ${g || '-'}`,
      tip: '✍️ ابعت حرف مباشرة (بدون أمر).'
    }
  };

  return TXT[lang] || TXT.en;
}

function isValidGuessChar(gameIsArabic, ch) {
  const s = String(ch || '');
  if (s.length !== 1) return false;
  return gameIsArabic ? /^[\u0600-\u06FF]$/.test(s) : /^[a-z]$/i.test(s);
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

async function safeSend(sock, chatId, payload, opts) {
  try {
    return await sock.sendMessage(chatId, payload, opts);
  } catch {}
}

function clearTimers(game) {
  try { if (game.chooseTimer) clearTimeout(game.chooseTimer); } catch {}
}

/* ================= MAIN HANDLERS ================= */

async function hangmanStart(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const uiLang = getLang(chatId);
  const T = getTexts(uiLang);

  if (hangmanGames[chatId]?.stage) {
    await safeReact(sock, chatId, message.key, '⚠️');
    return safeSend(sock, chatId, { text: T.already }, { quoted: message });
  }

  const game = {
    stage: 'choose',
    createdAt: Date.now(),
    // لغة الرسائل الافتراضية: لغة الجروب (بس هتتغير بعد اختيار 1/2)
    uiLang,
    // Timer اختيار اللغة
    chooseTimer: null
  };

  hangmanGames[chatId] = game;

  await safeReact(sock, chatId, message.key, '🎮');
  await safeSend(sock, chatId, { text: T.chooseLang }, { quoted: message });

  // Timeout لاختيار اللغة (60 ثانية)
  game.chooseTimer = setTimeout(async () => {
    const g = hangmanGames[chatId];
    if (!g || g.stage !== 'choose') return;

    const TT = getTexts(g.uiLang || uiLang);
    delete hangmanGames[chatId];
    await safeSend(sock, chatId, { text: TT.chooseTimeout });
  }, 60_000);
}

async function hangmanOnText(sock, message, text) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const game = hangmanGames[chatId];
  if (!game?.stage) return;

  const raw = String(text || '').trim();
  if (!raw) return;

  // ===== Language choice stage =====
  if (game.stage === 'choose') {
    const choice = raw.replace(/^\./, '').trim(); // احتياط لو حد كتب .1 بالغلط
    if (choice !== '1' && choice !== '2') return;

    clearTimers(game);

    const isArabic = choice === '1';
    const pickedUILang = isArabic ? 'ar' : 'en'; // ✅ لغة رسائل اللعبة = اختيار المستخدم
    const T = getTexts(pickedUILang);

    const word = isArabic ? pickRandom(wordsAr) : pickRandom(wordsEn);

    game.stage = 'play';
    game.isArabic = isArabic;
    game.uiLang = pickedUILang;

    game.word = String(word);
    game.wordLower = isArabic ? String(word) : String(word).toLowerCase(); // للإنجليزي حساس
    game.masked = maskWord(word);
    game.guessed = [];
    game.wrong = 0;
    game.max = 6;

    const maskedText = game.masked.join(' ');
    await safeReact(sock, chatId, message.key, '✅');

    return safeSend(
      sock,
      chatId,
      { text: `${T.started(maskedText)}\n\n${T.state(maskedText, 0, 6, '')}\n\n${T.tip}` },
      { quoted: message }
    );
  }

  // ===== Play stage =====
  if (game.stage !== 'play') return;

  const T = getTexts(game.uiLang || getLang(chatId));

  // accept ONLY first token (prevents "a b" spam)
  const guessToken = raw.split(/\s+/)[0] || '';
  const guess = game.isArabic ? guessToken : guessToken.toLowerCase();

  if (!isValidGuessChar(game.isArabic, guess)) {
    return safeSend(sock, chatId, { text: T.invalidLetter }, { quoted: message });
  }

  if (game.guessed.includes(guess)) {
    return safeSend(sock, chatId, { text: T.repeated(guess) }, { quoted: message });
  }

  game.guessed.push(guess);

  const wordCmp = game.isArabic ? game.word : game.wordLower;
  const masked = game.masked;

  const contains = wordCmp.includes(guess);

  if (contains) {
    for (let i = 0; i < game.word.length; i++) {
      const ch = game.word[i];
      const chCmp = game.isArabic ? ch : ch.toLowerCase();
      if (chCmp === guess) masked[i] = ch;
    }

    const maskedText = masked.join(' ');
    await safeReact(sock, chatId, message.key, '✅');

    await safeSend(
      sock,
      chatId,
      { text: `${T.correct(maskedText)}\n\n${T.state(maskedText, game.wrong, game.max, game.guessed.join(', '))}` },
      { quoted: message }
    );

    if (!masked.includes('_')) {
      delete hangmanGames[chatId];
      await safeReact(sock, chatId, message.key, '🎉');
      return safeSend(sock, chatId, { text: T.win(game.word) }, { quoted: message });
    }

    return;
  }

  // wrong guess
  game.wrong += 1;
  const left = Math.max(0, game.max - game.wrong);

  await safeReact(sock, chatId, message.key, '❌');

  await safeSend(
    sock,
    chatId,
    { text: `${T.wrong(left)}\n\n${T.state(masked.join(' '), game.wrong, game.max, game.guessed.join(', '))}` },
    { quoted: message }
  );

  if (game.wrong >= game.max) {
    delete hangmanGames[chatId];
    await safeReact(sock, chatId, message.key, '💀');
    return safeSend(sock, chatId, { text: T.lose(game.word) }, { quoted: message });
  }
}

async function hangmanCommand(sock, message) {
  return hangmanStart(sock, message);
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'hangman',
  aliases: ['hangman', 'المشنقة', 'لعبة_المشنقة'],
  category: {
    ar: '🎲 ألعاب ترفيهية',
    en: '🎲 Fun Games'
  },
  description: {
    ar: 'لعبة المشنقة مع اختيار اللغة (عربي/English). التخمين بكتابة الحرف مباشرة.',
    en: 'Hangman with language selection (Arabic/English). Guess by typing a letter directly.'
  },
  usage: {
    ar: '.hangman ثم اكتب 1 أو 2 ثم اكتب حروف',
    en: '.hangman then type 1 or 2 then type letters'
  },
  emoji: '🎮',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: hangmanCommand,
  run: hangmanCommand,
  execute: hangmanCommand,

  onText: hangmanOnText,

  // exports للتوافق/الاختبار
  hangmanStart,
  hangmanOnText
};