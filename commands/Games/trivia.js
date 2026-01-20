const { getLang } = require('../../lib/lang');

const games = {};

// ================= CONFIG =================
// ✅ المطلوب: وقت الأسئلة = 3 دقائق (يبدأ العد مع أول سؤال)
// مع بقاء رسالة القواعد دقيقة قبل البداية.
const TOTAL_QUESTIONS = 10;
const WAIT_BEFORE_START_SECONDS = 60; // first question after 1 minute (rules message)
const QUESTIONS_TOTAL_SECONDS = 180;  // 3 minutes for the 10 questions only

// Each question time derived from total questions window
const QUESTION_SECONDS = Math.max(5, Math.floor(QUESTIONS_TOTAL_SECONDS / TOTAL_QUESTIONS));
const QUESTION_MS = QUESTION_SECONDS * 1000;
const WAIT_MS = WAIT_BEFORE_START_SECONDS * 1000;
const QUESTIONS_TOTAL_MS = QUESTIONS_TOTAL_SECONDS * 1000;

/* =======================
   50 Arabic Questions
======================= */
const AR_QUESTIONS = [
  { q: 'ما هي عاصمة مصر؟', options: ['القاهرة', 'الإسكندرية', 'المنصورة', 'أسوان'], correctIndex: 0 },
  { q: 'كم عدد قارات العالم؟', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { q: 'من هو مخترع الهاتف؟', options: ['أديسون', 'جراهام بيل', 'تسلا', 'نيوتن'], correctIndex: 1 },
  { q: 'ما هو أسرع حيوان بري؟', options: ['الفهد', 'الأسد', 'الذئب', 'الحصان'], correctIndex: 0 },
  { q: 'أي كوكب هو الأقرب للشمس؟', options: ['الزهرة', 'المريخ', 'عطارد', 'الأرض'], correctIndex: 2 },
  { q: 'كم عدد أيام السنة الكبيسة؟', options: ['365', '366', '364', '360'], correctIndex: 1 },
  { q: 'ما هو أكبر محيط في العالم؟', options: ['الأطلسي', 'الهندي', 'الهادئ', 'المتجمد الشمالي'], correctIndex: 2 },
  { q: 'ما هي عاصمة السعودية؟', options: ['الرياض', 'جدة', 'مكة', 'الدمام'], correctIndex: 0 },
  { q: 'ما هي عاصمة المغرب؟', options: ['الرباط', 'الدار البيضاء', 'مراكش', 'طنجة'], correctIndex: 0 },
  { q: 'ما هو أطول نهر في العالم (حسب الشائع)؟', options: ['الأمازون', 'النيل', 'الدانوب', 'الكونغو'], correctIndex: 1 },
  { q: 'كم عدد ألوان قوس قزح؟', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { q: 'ما هو أكبر كوكب في المجموعة الشمسية؟', options: ['زحل', 'المشتري', 'نبتون', 'أورانوس'], correctIndex: 1 },
  { q: 'ما هي عاصمة فرنسا؟', options: ['باريس', 'ليون', 'مرسيليا', 'نيس'], correctIndex: 0 },
  { q: 'ما هي عاصمة إيطاليا؟', options: ['روما', 'ميلانو', 'نابولي', 'فلورنسا'], correctIndex: 0 },
  { q: 'ما هي عاصمة تركيا؟', options: ['إسطنبول', 'أنقرة', 'إزمير', 'بورصة'], correctIndex: 1 },
  { q: 'ما هو عدد حروف اللغة العربية؟', options: ['26', '28', '29', '30'], correctIndex: 1 },
  { q: 'أيّ مما يلي ليس من الحواس الخمس؟', options: ['الشم', 'اللمس', 'الذوق', 'الحدس'], correctIndex: 3 },
  { q: 'ما هو الغاز الضروري للتنفس؟', options: ['النيتروجين', 'الأكسجين', 'الهيدروجين', 'الهيليوم'], correctIndex: 1 },
  { q: 'ما هو أكبر قارة؟', options: ['أفريقيا', 'آسيا', 'أوروبا', 'أمريكا الجنوبية'], correctIndex: 1 },
  { q: 'ما هو أصغر قارة؟', options: ['أستراليا', 'أوروبا', 'أنتاركتيكا', 'أفريقيا'], correctIndex: 0 },
  { q: 'كم عدد الكواكب في المجموعة الشمسية؟', options: ['7', '8', '9', '10'], correctIndex: 1 },
  { q: 'من هو مؤلف “ألف ليلة وليلة” (ليست مؤلفًا واحدًا معروفًا)؟', options: ['مؤلف واحد', 'مجموعة رواة', 'تولستوي', 'شكسبير'], correctIndex: 1 },
  { q: 'أي دولة بها سور الصين العظيم؟', options: ['اليابان', 'الصين', 'كوريا', 'تايلاند'], correctIndex: 1 },
  { q: 'ما هو الحيوان الذي يُلقب بسفينة الصحراء؟', options: ['الحصان', 'الجمل', 'النعامة', 'الأسد'], correctIndex: 1 },
  { q: 'ما هو أكبر عضو في جسم الإنسان؟', options: ['القلب', 'الجلد', 'الكبد', 'المخ'], correctIndex: 1 },
  { q: 'كم عدد أسنان الإنسان البالغ عادة؟', options: ['28', '30', '32', '34'], correctIndex: 2 },
  { q: 'ما هي عاصمة الإمارات؟', options: ['دبي', 'أبوظبي', 'الشارقة', 'العين'], correctIndex: 1 },
  { q: 'ما هي عاصمة قطر؟', options: ['الدوحة', 'الريان', 'الوكرة', 'الخُور'], correctIndex: 0 },
  { q: 'ما هو أصغر كوكب؟', options: ['عطارد', 'الزهرة', 'المريخ', 'الأرض'], correctIndex: 0 },
  { q: 'كم عدد أضلاع المثلث؟', options: ['2', '3', '4', '5'], correctIndex: 1 },
  { q: 'كم عدد أضلاع المربع؟', options: ['3', '4', '5', '6'], correctIndex: 1 },
  { q: 'ما هي عاصمة العراق؟', options: ['الموصل', 'البصرة', 'بغداد', 'أربيل'], correctIndex: 2 },
  { q: 'ما هي عاصمة الأردن؟', options: ['عمان', 'إربد', 'الزرقاء', 'العقبة'], correctIndex: 0 },
  { q: 'ما هي عاصمة لبنان؟', options: ['طرابلس', 'صيدا', 'بيروت', 'جبيل'], correctIndex: 2 },
  { q: 'ما هي عاصمة سوريا؟', options: ['حلب', 'دمشق', 'حمص', 'اللاذقية'], correctIndex: 1 },
  { q: 'ما هي عاصمة الجزائر؟', options: ['وهران', 'قسنطينة', 'الجزائر', 'عنابة'], correctIndex: 2 },
  { q: 'ما هي عاصمة تونس؟', options: ['صفاقس', 'تونس', 'سوسة', 'قابس'], correctIndex: 1 },
  { q: 'ما هي عاصمة ليبيا؟', options: ['بنغازي', 'طرابلس', 'مصراتة', 'سبها'], correctIndex: 1 },
  { q: 'ما هو أكبر حيوان في العالم؟', options: ['الفيل', 'الحوت الأزرق', 'الزرافة', 'القرش الأبيض'], correctIndex: 1 },
  { q: 'ما هي لغة البرازيل الرسمية؟', options: ['الإسبانية', 'البرتغالية', 'الإنجليزية', 'الفرنسية'], correctIndex: 1 },
  { q: 'ما هي عاصمة اليابان؟', options: ['كيوتو', 'أوساكا', 'طوكيو', 'ناغويا'], correctIndex: 2 },
  { q: 'ما هي عاصمة الصين؟', options: ['شنغهاي', 'بكين', 'هونغ كونغ', 'شينزين'], correctIndex: 1 },
  { q: 'ما هو الكوكب الأحمر؟', options: ['المريخ', 'الزهرة', 'عطارد', 'نبتون'], correctIndex: 0 },
  { q: 'ما هو أقرب نجم للأرض؟', options: ['الشمس', 'سيريوس', 'فيجا', 'قطب الشمال'], correctIndex: 0 },
  { q: 'ما هو أكبر بحر داخلي؟', options: ['بحر العرب', 'بحر قزوين', 'البحر الأسود', 'بحر البلطيق'], correctIndex: 1 },
  { q: 'في أي قارة تقع مصر؟', options: ['آسيا', 'أوروبا', 'أفريقيا', 'أستراليا'], correctIndex: 2 },
  { q: 'ما هو ناتج 9×9؟', options: ['72', '81', '90', '99'], correctIndex: 1 },
  { q: 'ما هو الحيوان الذي ينام واقفًا غالبًا؟', options: ['الحصان', 'القطة', 'الكلب', 'الأرنب'], correctIndex: 0 },
  { q: 'أيّ عنصر يرمز له بـ Fe؟', options: ['الفضة', 'الحديد', 'الذهب', 'النحاس'], correctIndex: 1 }
];

/* =======================
   50 English Questions
======================= */
const EN_QUESTIONS = [
  { q: 'What is the capital of the United Kingdom?', options: ['London', 'Manchester', 'Liverpool', 'Birmingham'], correctIndex: 0 },
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correctIndex: 1 },
  { q: 'How many continents are there?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { q: 'What is the largest ocean?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], correctIndex: 2 },
  { q: 'Who wrote “Romeo and Juliet”?', options: ['Shakespeare', 'Dickens', 'Hemingway', 'Tolkien'], correctIndex: 0 },
  { q: 'What is H2O?', options: ['Salt', 'Water', 'Oxygen', 'Hydrogen'], correctIndex: 1 },
  { q: 'Which animal is the fastest land animal?', options: ['Cheetah', 'Lion', 'Horse', 'Wolf'], correctIndex: 0 },
  { q: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Marseille', 'Nice'], correctIndex: 0 },
  { q: 'What is the capital of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'], correctIndex: 2 },
  { q: 'Which gas do humans need to breathe?', options: ['Nitrogen', 'Oxygen', 'Helium', 'Carbon dioxide'], correctIndex: 1 },
  { q: 'How many days are in a leap year?', options: ['364', '365', '366', '367'], correctIndex: 2 },
  { q: 'Which is the largest planet?', options: ['Saturn', 'Jupiter', 'Neptune', 'Earth'], correctIndex: 1 },
  { q: 'What is the capital of Italy?', options: ['Milan', 'Rome', 'Naples', 'Venice'], correctIndex: 1 },
  { q: 'What is the smallest planet in our solar system?', options: ['Mars', 'Mercury', 'Venus', 'Earth'], correctIndex: 1 },
  { q: 'Which country built the Great Wall?', options: ['Japan', 'China', 'Korea', 'Thailand'], correctIndex: 1 },
  { q: 'How many letters are in the English alphabet?', options: ['24', '25', '26', '27'], correctIndex: 2 },
  { q: 'What is the largest mammal?', options: ['Elephant', 'Blue whale', 'Giraffe', 'Great white shark'], correctIndex: 1 },
  { q: 'Which continent is the largest?', options: ['Africa', 'Asia', 'Europe', 'South America'], correctIndex: 1 },
  { q: 'Which continent is the smallest?', options: ['Australia', 'Europe', 'Antarctica', 'Africa'], correctIndex: 0 },
  { q: 'What is 9 × 9?', options: ['72', '81', '90', '99'], correctIndex: 1 },
  { q: 'Which metal has the symbol Fe?', options: ['Gold', 'Iron', 'Silver', 'Copper'], correctIndex: 1 },
  { q: 'What is the boiling point of water (°C)?', options: ['90', '100', '110', '120'], correctIndex: 1 },
  { q: 'Which planet is closest to the sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], correctIndex: 2 },
  { q: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], correctIndex: 2 },
  { q: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctIndex: 2 },
  { q: 'Which is the longest river (common trivia)?', options: ['Amazon', 'Nile', 'Danube', 'Congo'], correctIndex: 1 },
  { q: 'How many colors are in a rainbow?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { q: 'Which instrument has 88 keys?', options: ['Guitar', 'Piano', 'Violin', 'Drums'], correctIndex: 1 },
  { q: 'Which animal is known as the “King of the Jungle”?', options: ['Tiger', 'Lion', 'Elephant', 'Leopard'], correctIndex: 1 },
  { q: 'What is the capital of Spain?', options: ['Barcelona', 'Madrid', 'Seville', 'Valencia'], correctIndex: 1 },
  { q: 'Which planet has rings?', options: ['Mars', 'Saturn', 'Mercury', 'Venus'], correctIndex: 1 },
  { q: 'What is the largest bone in the human body?', options: ['Skull', 'Femur', 'Rib', 'Humerus'], correctIndex: 1 },
  { q: 'How many sides does a triangle have?', options: ['2', '3', '4', '5'], correctIndex: 1 },
  { q: 'How many sides does a square have?', options: ['3', '4', '5', '6'], correctIndex: 1 },
  { q: 'What is the capital of Germany?', options: ['Munich', 'Berlin', 'Hamburg', 'Frankfurt'], correctIndex: 1 },
  { q: 'What is the capital of Russia?', options: ['Moscow', 'Kazan', 'Sochi', 'Novosibirsk'], correctIndex: 0 },
  { q: 'What is the main language of Brazil?', options: ['Spanish', 'Portuguese', 'English', 'French'], correctIndex: 1 },
  { q: 'Which is a primary color?', options: ['Purple', 'Green', 'Red', 'Pink'], correctIndex: 2 },
  { q: 'Which vitamin do we get from sunlight?', options: ['Vitamin A', 'Vitamin B', 'Vitamin C', 'Vitamin D'], correctIndex: 3 },
  { q: 'What is the largest desert?', options: ['Gobi', 'Sahara', 'Kalahari', 'Mojave'], correctIndex: 1 },
  { q: 'Which is the hardest natural substance?', options: ['Gold', 'Diamond', 'Iron', 'Silver'], correctIndex: 1 },
  { q: 'Which country is famous for the Eiffel Tower?', options: ['Italy', 'France', 'Germany', 'Spain'], correctIndex: 1 },
  { q: 'What do bees produce?', options: ['Milk', 'Honey', 'Oil', 'Water'], correctIndex: 1 },
  { q: 'Which animal is a mammal?', options: ['Shark', 'Dolphin', 'Octopus', 'Tuna'], correctIndex: 1 },
  { q: 'What is the capital of Turkey?', options: ['Istanbul', 'Ankara', 'Izmir', 'Bursa'], correctIndex: 1 },
  { q: 'Which is the tallest land animal?', options: ['Elephant', 'Giraffe', 'Horse', 'Camel'], correctIndex: 1 },
  { q: 'How many planets are in the solar system?', options: ['7', '8', '9', '10'], correctIndex: 1 },
  { q: 'Which country is known as the Land of the Rising Sun?', options: ['China', 'Japan', 'Korea', 'Thailand'], correctIndex: 1 },
  { q: 'What is the capital of Egypt?', options: ['Cairo', 'Alexandria', 'Giza', 'Aswan'], correctIndex: 0 }
];

function isGroup(chatId) {
  return String(chatId || '').endsWith('@g.us') || String(chatId || '').endsWith('@lid');
}

function getSenderId(message) {
  return message?.key?.participant || message?.key?.remoteJid || '';
}

function parseAnswerNumber(text) {
  const s = String(text || '').trim();
  if (!s) return -1;
  if (!/^\d+$/.test(s)) return -1;
  const n = parseInt(s, 10);
  if (n < 1 || n > 4) return -1;
  return n - 1; // 0..3
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function buildRules(lang) {
  if (lang === 'ar') {
    return (
      `🧠 *لعبة الأسئلة (Trivia)*\n\n` +
      `📌 *القواعد:*\n` +
      `• اللعبة = *${TOTAL_QUESTIONS} أسئلة* خلال *3 دقائق* (يبدأ العد مع أول سؤال)\n` +
      `• كل سؤال مدته *${QUESTION_SECONDS} ثانية*\n` +
      `• الاختيارات مرقمة: *1 / 2 / 3 / 4*\n` +
      `• الإجابة: اكتب *رقم الإجابة فقط* (بدون نقطة)\n` +
      `• أي شخص يجاوب صح خلال وقت السؤال ياخد *نقطة*\n\n` +
      `⏳ *أول سؤال هيبدأ بعد دقيقة...*`
    );
  }

  return (
    `🧠 *Trivia Game*\n\n` +
    `📌 *Rules:*\n` +
    `• Game = *${TOTAL_QUESTIONS} questions* in *3 minutes* (timer starts with Q1)\n` +
    `• Each question lasts *${QUESTION_SECONDS} seconds*\n` +
    `• Options are numbered: *1 / 2 / 3 / 4*\n` +
    `• Answer by typing the *number only* (no dot)\n` +
    `• Anyone who answers correctly within the question time gets *1 point*\n\n` +
    `⏳ *First question starts in one minute...*`
  );
}

function formatQuestion(lang, qIndex, total, q, options) {
  const header =
    lang === 'ar'
      ? `🧩 *سؤال ${qIndex}/${total}*\n\n`
      : `🧩 *Question ${qIndex}/${total}*\n\n`;

  let body = `${q}\n\n`;
  for (let i = 0; i < options.length; i++) {
    body += `${i + 1}) ${options[i]}\n`;
  }

  const footer =
    lang === 'ar'
      ? `\n✍️ اكتب رقم الإجابة (1-4) — *الوقت: ${QUESTION_SECONDS} ثانية*`
      : `\n✍️ Type the answer number (1-4) — *Time: ${QUESTION_SECONDS}s*`;

  return (header + body + footer).trim();
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
  try { if (game.startTimer) clearTimeout(game.startTimer); } catch {}
  try { if (game.qTimer) clearTimeout(game.qTimer); } catch {}
}

function pickQuestions(lang, totalNeeded) {
  const pool = lang === 'ar' ? AR_QUESTIONS : EN_QUESTIONS;
  const idxs = shuffle([...Array(pool.length)].map((_, i) => i));
  const take = idxs.slice(0, Math.min(totalNeeded, idxs.length));
  return take.map(i => pool[i]);
}

async function sendNextQuestion(sock, chatId) {
  const game = games[chatId];
  if (!game?.active) return;

  // End if finished
  if (game.current >= game.totalQuestions) {
    return finishGame(sock, chatId);
  }

  // Prepare next question
  const qObj = game.questions[game.current];
  if (!qObj) {
    return finishGame(sock, chatId);
  }

  game.current += 1;
  game.currentQuestion = {
    q: qObj.q,
    options: qObj.options,
    correctIndex: qObj.correctIndex,
    endsAt: Date.now() + QUESTION_MS,
    answeredUsers: new Set(),        // attempts (one per user)
    correctUsers: new Set(),         // users who got point
    // senderId -> { key: message.key, correct: boolean }
    answerKeys: new Map()
  };

  const text = formatQuestion(game.lang, game.current, game.totalQuestions, qObj.q, qObj.options);

  await safeSend(sock, chatId, { text }, { quoted: game.startQuoted || undefined });

  // Set per-question timeout
  clearTimeout(game.qTimer);
  game.qTimer = setTimeout(async () => {
    const g = games[chatId];
    if (!g?.active) return;

    const cq = g.currentQuestion;
    if (!cq) return;

    const correctNum = cq.correctIndex + 1;
    const correctText = cq.options[cq.correctIndex];

    const timeoutMsg =
      g.lang === 'ar'
        ? `⏳ انتهى وقت السؤال!\n✅ الإجابة الصحيحة: ${correctNum}) ${correctText}`
        : `⏳ Time is up!\n✅ Correct answer: ${correctNum}) ${correctText}`;

    // ✅ React on USERS' ANSWER messages after the question time ends
    // (☑️ for correct answers, ❎ for wrong answers)
    try {
      const answers = cq.answerKeys instanceof Map ? Array.from(cq.answerKeys.values()) : [];
      for (const a of answers) {
        if (!a?.key) continue;
        await safeReact(sock, chatId, a.key, a.correct ? '☑️' : '❎');
      }
    } catch {}

    await safeSend(sock, chatId, { text: timeoutMsg });

    // Next question immediately
    return sendNextQuestion(sock, chatId);
  }, QUESTION_MS);
}

async function finishGame(sock, chatId) {
  const game = games[chatId];
  if (!game) return;

  clearTimers(game);

  const scores = Object.entries(game.scores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // TOP 3 ONLY ✅

  const medals = ['🥇', '🥈', '🥉'];

  let text = game.lang === 'ar'
    ? '🏁 *النتائج النهائية*\n\n'
    : '🏁 *Final Results*\n\n';

  if (!scores.length) {
    text += game.lang === 'ar' ? 'محدش جاب نقاط 😅' : 'No points scored 😅';
    await safeSend(sock, chatId, { text });
    delete games[chatId];
    return;
  }

  scores.forEach(([u, s], i) => {
    const medal = medals[i] ? `${medals[i]} ` : '';
    text += `${medal}${i + 1}. @${u.split('@')[0]} : ${s}\n`;
  });

  const winner = scores[0]?.[0];
  if (winner) {
    text += game.lang === 'ar'
      ? `\n🏆 الفائز: @${winner.split('@')[0]}`
      : `\n🏆 Winner: @${winner.split('@')[0]}`;
  }

  await safeSend(sock, chatId, {
    text,
    mentions: scores.map(x => x[0])
  });

  delete games[chatId];
}

async function triviaStart(sock, message) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const lang = getLang(chatId);

  if (!isGroup(chatId)) {
    const msg = lang === 'ar'
      ? '❌ اللعبة دي شغالة في الجروبات فقط.'
      : '❌ This game works in groups only.';
    await safeSend(sock, chatId, { text: msg }, { quoted: message });
    return;
  }

  if (games[chatId]?.active) {
    const msg = lang === 'ar'
      ? '⚠️ فيه لعبة شغالة بالفعل في الجروب.'
      : '⚠️ A game is already running in this group.';
    await safeSend(sock, chatId, { text: msg }, { quoted: message });
    return;
  }

  const poolLang = lang === 'ar' ? 'ar' : 'en';
  const totalQuestions = TOTAL_QUESTIONS;

  const questions = pickQuestions(poolLang, totalQuestions);

  games[chatId] = {
    active: true,
    lang: poolLang,
    totalQuestions,
    current: 0,
    questions,
    scores: {},
    currentQuestion: null,
    startQuoted: message,
    startedAt: Date.now(),
    firstQuestionAt: Date.now() + WAIT_MS,
    endsAt: null // ✅ يبدأ العد مع أول سؤال
  };

  await safeReact(sock, chatId, message.key, '🧠');
  await safeSend(sock, chatId, { text: buildRules(poolLang) }, { quoted: message });

  // First question after 1 minute
  games[chatId].startTimer = setTimeout(async () => {
    const g = games[chatId];
    if (!g?.active) return;

    // ✅ وقت الجلسة (3 دقائق) يتحسب من هنا (مع أول سؤال)
    g.endsAt = Date.now() + QUESTIONS_TOTAL_MS;
    return sendNextQuestion(sock, chatId);
  }, WAIT_MS);
}

async function triviaOnText(sock, message, text) {
  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  const game = games[chatId];
  if (!game?.active) return;

  // ✅ خلال دقيقة القواعد (قبل أول سؤال) منستقبلش إجابات
  if (!game.endsAt) return;

  // Only during questions window
  if (Date.now() > game.endsAt) {
    return finishGame(sock, chatId);
  }

  const cq = game.currentQuestion;
  if (!cq) return; // still in 1-minute rules countdown

  if (Date.now() > cq.endsAt) return; // question already timed out, timer will handle

  const senderId = getSenderId(message);
  if (!senderId) return;

  const idx = parseAnswerNumber(text);
  if (idx < 0 || idx > 3) return; // only accept pure numbers 1..4

  // One attempt per user per question (prevents spam)
  if (cq.answeredUsers.has(senderId)) return;
  cq.answeredUsers.add(senderId);

  const correct = idx === cq.correctIndex;

  // ✅ نخزن رسالة المستخدم عشان نعمل React عليها بعد انتهاء الوقت
  try {
    if (cq.answerKeys && typeof cq.answerKeys.set === 'function') {
      cq.answerKeys.set(senderId, { key: message.key, correct });
    }
  } catch {}

  // ✅ نحسب النقطة فوراً (بس من غير React على رسالة المستخدم)
  if (correct) {
    cq.correctUsers.add(senderId);
    game.scores[senderId] = (game.scores[senderId] || 0) + 1;
  }
}

async function triviaCommand(sock, message, args = []) {
  return triviaStart(sock, message);
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'trivia',
  aliases: ['trivia', 'quiz', 'سؤال', 'اسئلة', 'مسابقة'],
  category: {
    ar: '🎲 ألعاب ترفيهية',
    en: '🎲 Fun Games'
  },
  description: {
    ar: 'لعبة أسئلة جماعية: 10 أسئلة في 5 دقائق، الإجابة بأرقام 1-4.',
    en: 'Group trivia game: 10 questions in 5 minutes, answer with numbers 1-4.'
  },
  usage: {
    ar: '.trivia',
    en: '.trivia'
  },
  emoji: '🧠',
  admin: false,
  owner: false,
  showInMenu: true,

  exec: triviaCommand,
  run: triviaCommand,
  execute: triviaCommand,

  // لازم السيستم ينادي onText لكل الرسائل النصية
  onText: triviaOnText
};