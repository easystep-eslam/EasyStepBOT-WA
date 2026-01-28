const fs = require('fs');
const path = require('path');

const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

const DB_PATH = path.join(process.cwd(), 'data', 'reactraffles.json');

function normalizeJid(jid = '') {
  return String(jid).split(':')[0];
}

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8') || '{}') || {};
  } catch {
    return {};
  }
}

function writeDB(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db || {}, null, 2));
  } catch {}
}

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

function getQuotedId(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo || {};
  return ctx?.stanzaId || null;
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    if (!key) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT() {
  // User requested BOTH languages in the same message (DM/Group language irrelevant)
  return {
    start: `🎉 تم بدء السحب\nبرجاء التفاعل (React) على الرسالة الأساسية المشار إليها للاشتراك.\n\n🎉 Raffle Started\nPlease react to the referenced main message to enter.`,
    noActive: `ℹ️ لا يوجد سحب نشط حالياً.\nابدأ أولاً بـ .تفاعل\n\nℹ️ No active raffle.\nStart first with .raffle`,
    noEntries: `ℹ️ لا يوجد مشاركون حتى الآن.\n\nℹ️ No participants yet.`,
    noEligible: `ℹ️ تم السحب على جميع المشاركين. لا يوجد أسماء متبقية.\n\nℹ️ All participants have already won. No eligible users left.`,
    result: (count, winnerNum) =>
      `👥 عدد المشاركين: *${count}*\n🏆 الفائز: @${winnerNum}\n\n👥 Participants: *${count}*\n🏆 Winner: @${winnerNum}`,
    onlyGroup: '❌ الأمر ده للجروبات بس.\n\n❌ This command can only be used in groups.',
    needBotAdmin: '❌ لازم تخلي البوت أدمن الأول.\n\n❌ Please make the bot an admin first.',
    needSenderAdmin: '❌ الأمر ده للأدمن فقط.\n\n❌ Only group admins can use this command.',
    err: '❌ حصل خطأ. جرّب تاني.\n\n❌ An error occurred. Please try again.'
  };
}

function ensureChat(db, chatId) {
  if (!db[chatId]) db[chatId] = {};
  if (!db[chatId].__meta) db[chatId].__meta = {};
  return db;
}

function setLastTarget(db, chatId, targetId) {
  db = ensureChat(db, chatId);
  db[chatId].__meta.lastTargetId = targetId;
  return db;
}

function getLastTarget(db, chatId) {
  return db?.[chatId]?.__meta?.lastTargetId || null;
}

async function startRaffle(sock, chatId, message, targetId) {
  const T = TXT();

  const db = ensureChat(readDB(), chatId);
  db[chatId][targetId] = {
    active: true,
    targetId,
    createdBy: normalizeJid(message?.key?.participant || message?.key?.remoteJid),
    createdAt: Date.now(),
    entries: [],
    winners: []
  };
  setLastTarget(db, chatId, targetId);
  writeDB(db);

  // Hidden mention to all group members (no @ visible in text)
  let mentions = [];
  try {
    const meta = await sock.groupMetadata(chatId);
    mentions = (meta?.participants || []).map(p => p.id).filter(Boolean).map(normalizeJid);
    mentions = Array.from(new Set(mentions));
  } catch {}

  await safeReact(sock, chatId, message?.key, '🎉');
  await sock.sendMessage(chatId, { text: T.start, mentions }, { quoted: message }).catch(() => {});
}

function pickRandom(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

async function draw(sock, chatId, message, targetId) {
  const T = TXT();
  const db = readDB();
  const raffle = db?.[chatId]?.[targetId];

  const entries = Array.isArray(raffle?.entries) ? Array.from(new Set(raffle.entries.map(normalizeJid))) : [];
  if (!entries.length) {
    await safeReact(sock, chatId, message?.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.noEntries }, { quoted: message }).catch(() => {});
    return;
  }

  const winners = Array.isArray(raffle?.winners) ? Array.from(new Set(raffle.winners.map(normalizeJid))) : [];
  const eligible = entries.filter(j => !winners.includes(j));

  if (!eligible.length) {
    await safeReact(sock, chatId, message?.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.noEligible }, { quoted: message }).catch(() => {});
    return;
  }

  const winnerJid = pickRandom(eligible);
  if (!winnerJid) {
    await safeReact(sock, chatId, message?.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.noEligible }, { quoted: message }).catch(() => {});
    return;
  }

  // remove from participants (as requested) + keep in winners to prevent repeats
  const countBefore = entries.length;

  raffle.winners = Array.isArray(raffle.winners) ? raffle.winners.map(normalizeJid) : [];
  raffle.winners.push(winnerJid);

  raffle.entries = entries.filter(j => j !== winnerJid);

  db[chatId][targetId] = raffle;
  setLastTarget(db, chatId, targetId);
  writeDB(db);

  const winnerNum = String(normalizeJid(winnerJid)).replace(/\D/g, '');
  await safeReact(sock, chatId, message?.key, '🏆');
  await sock.sendMessage(
    chatId,
    { text: T.result(countBefore, winnerNum), mentions: [winnerJid] },
    { quoted: message }
  ).catch(() => {});
}

async function handle(sock, chatId, message) {
  const T = TXT();
  if (!chatId) return;

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message }).catch(() => {});
    return;
  }

  const senderId = normalizeJid(message?.key?.participant || message?.key?.remoteJid);
  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message?.key, '❌');
    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message }).catch(() => {});
    return;
  }

  if (!adminStatus?.isSenderAdmin && !message?.key?.fromMe) {
    await safeReact(sock, chatId, message?.key, '🚫');
    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message }).catch(() => {});
    return;
  }

  const raw = getText(message).trim();
  const used = (raw.split(/\s+/)[0] || '').toLowerCase();
  const cmd = used.startsWith('.') ? used.slice(1) : used;

  if (cmd !== 'تفاعل' && cmd !== 'raffle' && cmd !== 'سحب' && cmd !== 'draw') return;

  const quotedId = getQuotedId(message);
  const targetId = quotedId || message?.key?.id;

  if (cmd === 'تفاعل' || cmd === 'raffle') {
    await startRaffle(sock, chatId, message, targetId);
    return;
  }

  // draw
  const db = readDB();
  const realTarget = quotedId || getLastTarget(db, chatId) || targetId;
  const raffle = db?.[chatId]?.[realTarget];

  if (!raffle?.active) {
    await safeReact(sock, chatId, message?.key, 'ℹ️');
    await sock.sendMessage(chatId, { text: T.noActive }, { quoted: message }).catch(() => {});
    return;
  }

  await draw(sock, chatId, message, realTarget);
}

async function exec(sock, message) {
  return handle(sock, message?.key?.remoteJid, message);
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'reactraffle',
  commands: ['تفاعل', 'raffle', 'سحب', 'draw'],
  aliases: ['قرعة', 'raff', 'اسحب'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  description: {
    ar: 'بدء سحب من تفاعلات رسالة معينة واختيار فائز عشوائي.',
    en: 'Start a raffle from reactions on a target message and draw a random winner.'
  },
  usage: {
    ar: '.تفاعل (ريبلاي أو بدون)\n.سحب (بدون أو مع ريبلاي)',
    en: '.raffle (reply or not)\n.draw (with/without reply)'
  },
  emoji: '🎉',
  admin: true,
  owner: false,
  showInMenu: true,
  exec,
  run: (sock, chatId, message) => handle(sock, chatId, message),
  execute: exec
};
