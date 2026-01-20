const settings = require('../settings');

const fs = require('fs');
const path = require('path');

const { getLang } = require('../lib/lang');

const commandsPath = __dirname;

const MENU_TTL_MS = 5 * 60 * 1000;

function menuState() {
  if (!global.__MENU_STATE__ || !(global.__MENU_STATE__ instanceof Map)) {
    global.__MENU_STATE__ = new Map();
  }
  return global.__MENU_STATE__;
}

function setMenu(chatId, categories) {
  menuState().set(chatId, {
    categories: Array.isArray(categories) ? categories : [],
    at: Date.now()
  });
}

function getMenu(chatId) {
  const st = menuState().get(chatId);
  if (!st) return null;
  if (!st.at || Date.now() - st.at > MENU_TTL_MS) {
    menuState().delete(chatId);
    return null;
  }
  return st;
}

function TT(chatId) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      noCommands: 'No commands found.',
      error: '❌ Something went wrong. Please try again.',
      invalidPick: '❌ Invalid number. Reply with a valid category number.',
      backHint: '↩️ 0 Back to categories',
      sendHint: '↳ Send category number',
      mainHint: 'Type 0 to return to the main menu.',
      sep: '----------------------------'
    },
    ar: {
      noCommands: 'مفيش أوامر متاحة.',
      error: '❌ حصل خطأ أثناء عرض المنيو.',
      invalidPick: '❌ رقم غير صحيح. اكتب رقم قسم صحيح.',
      backHint: '↩️ 0 عودة للقائمة الرئيسية',
      sendHint: '↳ اكتب رقم القسم',
      mainHint: 'اكتب 0 للرجوع للقائمة الرئيسية.',
      sep: '----------------------------'
    }
  };

  return { lang, T: TXT[lang] || TXT.en };
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function isArabicText(s) {
  return /[\u0600-\u06FF]/.test(String(s || ''));
}

function isEnglishAlias(s) {
  const x = String(s || '').trim();
  if (!x) return false;
  if (isArabicText(x)) return false;
  return /^[a-z0-9_]+$/i.test(x);
}

function unique(arr) {
  return [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

function pickFirstArabic(aliases) {
  const list = unique(aliases);
  return list.find((a) => isArabicText(a)) || null;
}

function pickFirstEnglish(aliases) {
  const list = unique(aliases);
  return list.find((a) => isEnglishAlias(a)) || null;
}

function pickShortest(list) {
  const arr = unique(list);
  if (!arr.length) return null;
  arr.sort((a, b) => {
    const la = a.length;
    const lb = b.length;
    if (la !== lb) return la - lb;
    return a.localeCompare(b, 'en');
  });
  return arr[0];
}

function pickSmallestAlphabetical(list) {
  const arr = unique(list);
  if (!arr.length) return null;
  arr.sort((a, b) => a.localeCompare(b, 'en'));
  return arr[0];
}

function safeCategory(command) {
  const fallback = { ar: '🌐 أوامر عامة', en: '🌐 General Commands' };
  if (!command || !command.category) return fallback;

  if (typeof command.category === 'string') {
    return { ar: command.category, en: command.category };
  }

  if (typeof command.category === 'object') {
    return {
      ar: command.category.ar || fallback.ar,
      en: command.category.en || fallback.en
    };
  }

  return fallback;
}

function safeDesc(command, lang) {
  const d = command?.description;
  if (!d) return '';
  if (typeof d === 'string') return d.trim();
  if (typeof d === 'object') return String(d[lang] || d.en || d.ar || '').trim();
  return '';
}

function safeEmoji(command) {
  const e = command?.emoji;
  if (typeof e === 'string' && e.trim()) return e.trim();
  return '';
}

function walkJsFiles(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walkJsFiles(full));
    else if (ent.isFile() && ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function normalizeCommandId(command) {
  const name = String(command?.name || '').trim().toLowerCase();
  return name || 'command';
}

function autoEmoji(command, lang) {
  const explicit = safeEmoji(command);
  if (explicit) return explicit;

  const cat = safeCategory(command);
  const catName = String((lang === 'ar' ? cat.ar : cat.en) || '').toLowerCase();
  const id = normalizeCommandId(command);
  const aliases = unique(command?.aliases || []).map((a) => a.toLowerCase());
  const hay = [id, ...aliases, catName].join(' ');

  const rules = [
    { re: /(help|menu|commands|أوامر|منيو|مساعدة)/i, emoji: '📜' },
    { re: /(welcome|ترحيب|wel)/i, emoji: '👋' },
    { re: /(goodbye|وداع|خروج)/i, emoji: '👋' },
    { re: /(promote|ترقية|رفع)/i, emoji: '👑' },
    { re: /(demote|تنزيل|خفض)/i, emoji: '📉' },
    { re: /(ban|حظر|block)/i, emoji: '🚫' },
    { re: /(unban|فك_حظر|سماح|unblock)/i, emoji: '✅' },
    { re: /(kick|طرد|remove)/i, emoji: '🥾' },
    { re: /(add|إضافة|invite|دعوة)/i, emoji: '➕' },
    { re: /(link|resetlink|revoke|رابط)/i, emoji: '♻️' },
    { re: /(antilink|منع_الروابط)/i, emoji: '⛔' },
    { re: /(antibadword|منع_الكلمات)/i, emoji: '🧼' },
    { re: /(delete|del|مسح|حذف|clear)/i, emoji: '🧹' },
    { re: /(tag|tagall|mention|منشن|hidetag)/i, emoji: '📣' },
    { re: /(warn|warning|تحذير|إنذار)/i, emoji: '⚠️' },
    { re: /(warnings|warns|تحذيرات)/i, emoji: '📋' },
    { re: /(chatbot|شاتبوت|بوت_شات)/i, emoji: '🤖' },
    { re: /(fact|معلومة|حقائق)/i, emoji: '🧠' },
    { re: /(wasted|rip|ميت|واستد)/i, emoji: '🪦' },
    { re: /(topmembers|top|توب|نشاط|تفاعل)/i, emoji: '🏆' },
    { re: /(setgname|gname)/i, emoji: '✏️' },
    { re: /(setgdesc|gdesc)/i, emoji: '📝' },
    { re: /(setgpp|gpp|photo|صورة)/i, emoji: '🖼️' },
    { re: /(download|song|play|mp3|yt|يوتيوب|تحميل)/i, emoji: '📥' },
    { re: /(ai|gpt|ذكاء|شات|chat)/i, emoji: '🤖' },
    { re: /(admin|أدمن|ادمن|manage|إدارة)/i, emoji: '👑' }
  ];

  for (const r of rules) {
    if (r.re.test(hay)) return r.emoji;
  }

  if (catName.includes('admin') || catName.includes('أدمن') || catName.includes('manage')) return '👑';
  if (catName.includes('fun') || catName.includes('ترفيه') || catName.includes('games')) return '🎉';
  return '⚙️';
}

function smartSplitTokens(txt) {
  return String(txt || '')
    .replace(/[.*()[\]{}?^$+|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean);
}

function autoDesc(command, lang) {
  const existing = safeDesc(command, lang);
  if (existing) return existing;

  const name = normalizeCommandId(command);
  const aliases = unique(command?.aliases || []);
  const cat = safeCategory(command);
  const catName = String((lang === 'ar' ? cat.ar : cat.en) || '').toLowerCase();

  const tokens = new Set([
    ...smartSplitTokens(name),
    ...smartSplitTokens(aliases.join(' ')),
    ...smartSplitTokens(catName)
  ]);

  const has = (...keys) => keys.some((k) => tokens.has(k));

  if (has('help', 'menu', 'commands', 'منيو', 'أوامر', 'اوامر')) {
    return lang === 'ar' ? 'عرض أقسام الأوامر داخل البوت.' : 'Show bot command categories.';
  }
  if (has('welcome', 'wel', 'ترحيب')) {
    return lang === 'ar' ? 'تشغيل/تعديل رسالة الترحيب للأعضاء الجدد.' : 'Enable/edit the welcome message for new members.';
  }
  if (has('goodbye', 'وداع', 'خروج')) {
    return lang === 'ar' ? 'تشغيل/تعديل رسالة الوداع عند خروج الأعضاء.' : 'Enable/edit the goodbye message when members leave.';
  }
  if (has('promote', 'ترقية', 'رفع')) {
    return lang === 'ar' ? 'ترقية عضو/أعضاء لمشرف.' : 'Promote member(s) to admin.';
  }
  if (has('demote', 'تنزيل', 'خفض')) {
    return lang === 'ar' ? 'تنزيل مشرف إلى عضو عادي.' : 'Demote an admin back to a member.';
  }
  if (has('ban', 'حظر', 'block')) {
    return lang === 'ar' ? 'حظر مستخدم من استخدام البوت.' : 'Ban a user from using the bot.';
  }
  if (has('unban', 'unblock')) {
    return lang === 'ar' ? 'إلغاء حظر مستخدم.' : 'Unban a user.';
  }
  if (has('kick', 'طرد', 'remove')) {
    return lang === 'ar' ? 'طرد عضو/أعضاء من الجروب.' : 'Remove member(s) from the group.';
  }
  if (has('add', 'invite', 'إضافة', 'دعوة')) {
    return lang === 'ar' ? 'إضافة عضو للجروب أو إرسال دعوة.' : 'Add a member to the group or send an invite.';
  }
  if (has('link', 'resetlink', 'revoke', 'رابط')) {
    return lang === 'ar' ? 'إدارة رابط دعوة الجروب.' : 'Manage the group invite link.';
  }
  if (has('delete', 'del', 'clear', 'مسح', 'حذف')) {
    return lang === 'ar' ? 'تنظيف/مسح رسائل.' : 'Clear/delete messages.';
  }
  if (has('tag', 'tagall', 'mention', 'منشن', 'hidetag')) {
    return lang === 'ar' ? 'منشن للأعضاء.' : 'Mention group members.';
  }
  if (has('warn', 'warning', 'تحذير', 'إنذار')) {
    return lang === 'ar' ? 'إعطاء تحذير لعضو.' : 'Give a warning to a member.';
  }
  if (has('wasted', 'rip', 'ميت', 'واستد')) {
    return lang === 'ar' ? 'إنشاء صورة Wasted (منشن/رد).' : 'Generate a Wasted image (mention/reply).';
  }
  if (has('download', 'song', 'play', 'mp3', 'yt', 'يوتيوب', 'تحميل')) {
    return lang === 'ar' ? 'تحميل صوت/أغاني من يوتيوب.' : 'Download audio/songs from YouTube.';
  }
  if (has('ai', 'gpt', 'ذكاء', 'chat', 'شات')) {
    return lang === 'ar' ? 'أوامر الذكاء الاصطناعي.' : 'AI commands.';
  }

  return lang === 'ar' ? 'أمر داخل البوت.' : 'A bot command.';
}

function buildCommandLine(command, lang) {
  const aliases = unique(command?.aliases || []);
  const enAliases = aliases.filter(isEnglishAlias);
  const arAliases = aliases.filter(isArabicText);

  const emoji = autoEmoji(command, lang);
  const arName = pickFirstArabic(aliases) || command.name;
  const enName = pickFirstEnglish(aliases) || command.name;

  const shortAr = pickShortest(arAliases) || arName;
  const shortEn = pickShortest(enAliases) || enName;

  const head = `${emoji ? `${emoji} ` : ''}${lang === 'ar' ? arName : enName} (${shortEn}/${shortAr})`.trim();
  const desc = autoDesc(command, lang);

  return { head, desc };
}

function loadCommandsByCategory(lang) {
  const categories = {};
  const files = walkJsFiles(commandsPath);

  for (const filePath of files) {
    if (path.basename(filePath).toLowerCase() === 'help.js') continue;

    let command;
    try {
      delete require.cache[require.resolve(filePath)];
      command = require(filePath);
    } catch {
      continue;
    }

    if (Array.isArray(command)) continue;
    if (!command?.name) continue;
    if (command.hidden === true) continue;
    if (command.showInMenu === false) continue;

    const catObj = safeCategory(command);
    const catName = lang === 'ar' ? catObj.ar : catObj.en;
    if (!categories[catName]) categories[catName] = [];

    const { head, desc } = buildCommandLine(command, lang);
    if (!head) continue;

    categories[catName].push({ head, desc });
  }

  Object.keys(categories).forEach((k) => {
    categories[k].sort((a, b) => String(a.head || '').localeCompare(String(b.head || ''), 'en'));
  });

  return categories;
}

function circledNumber(n) {
  const map = [
    '⓪',
    '❶',
    '❷',
    '❸',
    '❹',
    '❺',
    '❻',
    '❼',
    '❽',
    '❾',
    '❿',
    '⓫',
    '⓬',
    '⓭',
    '⓮',
    '⓯',
    '⓰',
    '⓱',
    '⓲',
    '⓳',
    '⓴'
  ];
  return map[n] || `${n}`;
}

function buildCategoriesCaption(lang, catNames) {
  const botName = settings?.botName || 'EasyStep-BOT';
  const version = settings?.version || '1.0.0';
  const owner = settings?.botOwner || 'Eslam';

  const header =
    lang === 'ar'
      ? `┏━━━ 🖤 ${botName} 🖤 ━━━━┓\n┃ 📦 الإصدار: ${version}\n┃ 👤 المالك: ${owner}\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n▣ أقسام الأوامر ▣\n`
      : `┏━━━ 🖤 ${botName} 🖤 ━━━━┓\n┃ 📦 Version: ${version}\n┃ 👤 Owner: ${owner}\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n▣ Command Categories ▣\n`;

  const list = (catNames || []).map((c, i) => `${circledNumber(i + 1)} ${c}`).join('\n');

  const footer =
    lang === 'ar'
      ? `\n━━━━━━━━━━━━━━\n${'↳ اكتب رقم القسم'}\n━━━━━━━━━━━━━━\n${'اكتب ⓪ للقائمة الرئيسية'}`
      : `\n━━━━━━━━━━━━━━\n${'↳ Send category number'}\n━━━━━━━━━━━━━━\n${'Type ⓪ for main menu'}`;

  return `${header}\n${list || (lang === 'ar' ? 'مفيش أقسام متاحة.' : 'No categories found.')}${footer}`;
}

function buildCategoryCaption(lang, categoryName, items, sep, backHint) {
  const botName = settings?.botName || 'EasyStep-BOT';

  const head =
    lang === 'ar'
      ? `╔═══ 👑 ${categoryName} 👑 ═══╗\n║ ${botName} Control   ║\n╚═══════════════════════╝\n\n`
      : `╔═══ 👑 ${categoryName} 👑 ═══╗\n║ ${botName} Control   ║\n╚═══════════════════════╝\n\n`;

  const body = (items || []).length
    ? items
        .map((it) => `${it.head}\n${it.desc}`.trim())
        .filter(Boolean)
        .join(`\n${sep}\n`)
    : lang === 'ar'
      ? 'مفيش أوامر في القسم ده.'
      : 'No commands in this category.';

  const tail = `\n\n━━━━━━━━━━━━━━\n${backHint}`;

  return `${head}${body}${tail}`;
}

function getBotMenuImageBuffer() {
  const p1 = path.join(process.cwd(), 'assets', 'bot_image.jpg');
  const p2 = path.join(process.cwd(), 'assets', 'bot_image.png');
  const p3 = path.join(process.cwd(), 'assets', 'bot_image.webp');
  const p4 = path.join(process.cwd(), 'assets', 'menu.jpg');
  const p5 = path.join(process.cwd(), 'assets', 'menu.png');

  const candidates = [p1, p2, p3, p4, p5];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        if (buf && buf.length) return buf;
      }
    } catch {}
  }
  return null;
}

function parsePick(args) {
  if (!Array.isArray(args) || !args.length) return null;
  const x = String(args[0] || '').trim();
  if (!/^\d+$/.test(x)) return null;
  return parseInt(x, 10);
}

async function helpCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid || message?.chat;
  if (!chatId) return;

  const { lang, T } = TT(chatId);

  try {
    await safeReact(sock, chatId, message.key, '📜');

    const categoriesMap = loadCommandsByCategory(lang);
    const catNames = Object.entries(categoriesMap)
      .filter(([, cmds]) => Array.isArray(cmds) && cmds.length)
      .map(([k]) => k)
      .sort((a, b) => String(a).localeCompare(String(b), lang === 'ar' ? 'ar' : 'en'));

    const pick = parsePick(args);

    if (!pick || pick === 0) {
      setMenu(chatId, catNames);

      const caption = buildCategoriesCaption(lang, catNames);
      const img = getBotMenuImageBuffer();

      if (img) {
        await sock.sendMessage(chatId, { image: img, caption }, { quoted: message });
      } else {
        await sock.sendMessage(chatId, { text: caption }, { quoted: message });
      }

      await safeReact(sock, chatId, message.key, '✅');
      return;
    }

    const st = getMenu(chatId);
    const list = st?.categories?.length ? st.categories : catNames;

    if (!list.length || pick < 1 || pick > list.length) {
      await sock.sendMessage(chatId, { text: T.invalidPick }, { quoted: message });
      await safeReact(sock, chatId, message.key, '❌');
      return;
    }

    const chosen = list[pick - 1];
    const cmds = categoriesMap[chosen] || [];

    const caption = buildCategoryCaption(lang, chosen, cmds, T.sep, T.backHint);
    const img = getBotMenuImageBuffer();

    if (img) {
      await sock.sendMessage(chatId, { image: img, caption }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    }

    await safeReact(sock, chatId, message.key, '✅');
  } catch (err) {
    console.error('Help command error:', err);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'help',
  aliases: ['menu', 'منيو', 'اوامر', 'أوامر'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'عرض أقسام الأوامر بشكل مرقم ثم عرض أوامر أي قسم عند كتابة رقمه (بدون نقطة).',
    en: 'Show numbered command categories, then show a category commands by replying with its number (no dot).'
  },
  usage: {
    ar: '.menu ثم اكتب رقم القسم',
    en: '.menu then reply with the category number'
  },
  admin: false,
  owner: false,
  showInMenu: true,
  emoji: '📜',
  exec: helpCommand,
  run: helpCommand,
  execute: (sock, message, args) => helpCommand(sock, message, args)
};