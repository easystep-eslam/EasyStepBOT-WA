// ===== React Raffle (tools/reactraffle) =====
const fs = require('fs');
const path = require('path');

const _RR_DB_PATH = path.join(process.cwd(), 'data', 'reactraffles.json');

function _rrNormalizeJid(jid = '') {
  return String(jid).split(':')[0];
}

function _rrReadDB() {
  try {
    if (!fs.existsSync(_RR_DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(_RR_DB_PATH, 'utf8') || '{}') || {};
  } catch {
    return {};
  }
}

let _rrWriteTimer = null;
let _rrPendingDB = null;

function _rrScheduleWrite(db) {
  _rrPendingDB = db;
  if (_rrWriteTimer) return;
  _rrWriteTimer = setTimeout(() => {
    try {
      const dir = path.dirname(_RR_DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(_RR_DB_PATH, JSON.stringify(_rrPendingDB || {}, null, 2));
    } catch {}
    _rrWriteTimer = null;
    _rrPendingDB = null;
  }, 800);
}

function _rrHandleReactionMessage(msg) {
  try {
    const chatId = msg?.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) return false;

    const r = msg?.message?.reactionMessage;
    if (!r) return false;

    const targetId = r?.key?.id;
    const reactor = _rrNormalizeJid(msg?.key?.participant);
    const emoji = (r?.text ?? '').trim(); // empty means removed in many baileys builds

    if (!targetId || !reactor) return true; // it's a reaction but can't map -> stop normal flow

    const db = _rrReadDB();
    const raffle = db?.[chatId]?.[targetId];

    if (!raffle || !raffle.active) return true; // reaction not for an active raffle -> ignore other processing

    if (!Array.isArray(raffle.entries)) raffle.entries = [];
    raffle.entries = raffle.entries.map(_rrNormalizeJid);

    const idx = raffle.entries.indexOf(reactor);

    if (!emoji) {
      // removed reaction => remove from participants
      if (idx !== -1) raffle.entries.splice(idx, 1);
    } else {
      // added/changed reaction => ensure participant exists
      if (idx === -1) raffle.entries.push(reactor);
    }

    db[chatId][targetId] = raffle;
    _rrScheduleWrite(db);
    return true;
  } catch {
    return false;
  }
}
// ===========================================

// main.js (refactored)

// EasyStep-BOT


const path = require('path');

const moment = require('moment-timezone');

// ================================

// ✅ Settings / Lib

// ================================

const settings = require('./settings');

// chatId -> { cmd, expiresAt }
const ACTIVE_GAME_SESSIONS = new Map();

const GAME_DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GAME_SESSION_NAMES = new Set(['hangman', 'trivia', 'ttt', 'tictactoe', 'xo']);

function setGameSession(chatId, cmd) {
  if (!chatId || !cmd) return;
  const ttl = Number(cmd.sessionTTL) > 0 ? Number(cmd.sessionTTL) : GAME_DEFAULT_TTL_MS;
  ACTIVE_GAME_SESSIONS.set(chatId, { cmd, expiresAt: Date.now() + ttl });
}

const { getLang } = require('./lib/lang');

const isAdmin = require('./lib/isAdmin');

const isOwnerOrSudo = require('./lib/isOwner');

// Optional closest-command helper

let findClosestCommand = null;

try { ({ findClosestCommand } = require('./lib/findClosestCommand')); } catch {}

// Optional auto-reaction helper

let addCommandReaction = null;

try { ({ addCommandReaction } = require('./lib/areact')); } catch {}

let pmblocker = null;

try { pmblocker = require('./commands/owner/pmblocker'); } catch {}

// ================================

// 🌍 Timezone

// ================================

moment.tz.setDefault('Africa/Cairo');

// ================================

// 🧹 Temp dir

// ================================

const customTemp = path.join(process.cwd(), 'temp');

if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

process.env.TMPDIR = customTemp;

process.env.TEMP = customTemp;

process.env.TMP = customTemp;

// ================================

// 🔧 Bot identity

// ================================

global.botName = 'EasyStep-BOT';

// ================================

// 🧩 Multi-session helper (LOG ONLY)

// ================================

function sessTag(sock) {

  const sid = sock?.sessionId || sock?.user?.id?.split(':')?.[0] || '';

  return sid ? `[S:${sid}]` : '';

}

// ================================

// 🗂️ Commands auto-loader (recursive)

// ================================

function findCommandsDir() {

  const candidates = [

    __dirname,

    process.cwd(),

  ];

  for (const base of candidates) {

    try {

      const ents = fs.readdirSync(base, { withFileTypes: true });

      for (const ent of ents) {

        if (!ent.isDirectory()) continue;

        // IMPORTANT: some zips contain folders like "commands " (with trailing spaces)

        if (ent.name.trim().toLowerCase() === 'commands') {

          return path.join(base, ent.name);

        }

      }

    } catch {}

  }

  // Fallback (normal case)

  return path.join(__dirname, 'commands');

}

const COMMANDS_DIR = findCommandsDir();

function walkJsFiles(dir) {

  let out = [];

  if (!fs.existsSync(dir)) return out;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {

    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) out = out.concat(walkJsFiles(p));

    else if (ent.isFile() && ent.name.endsWith('.js')) out.push(p);

  }

  return out;

}

function normalizeKey(s) {

  return String(s || '').trim().toLowerCase();

}

function pickExec(cmd) {

  return cmd.exec || cmd.execute || cmd.run || null;

}

function loadAllCommands() {

  const map = new Map();

  const list = [];

  const files = walkJsFiles(COMMANDS_DIR);

  if (!files.length) {

    console.log('❌ No command files found. Check commands folder path: ' + COMMANDS_DIR);

  }

  const register = (rawCmd, filePath) => {

    if (!rawCmd) return;

    // Support commands exporting arrays (multiple commands in one file)

    if (Array.isArray(rawCmd)) {

      for (const c of rawCmd) register(c, filePath);

      return;

    }

    const cmd = rawCmd;

    // Fallback: if name is missing but aliases exist, use first alias as name

    if (!cmd.name && Array.isArray(cmd.aliases) && cmd.aliases.length) {

      cmd.name = String(cmd.aliases[0]).replace(/^\./, '');

    }

    if (!cmd.name) return;

    const execFn = pickExec(cmd);

    if (typeof execFn !== 'function') return;

    // normalize common fields

    cmd.exec = execFn;

    cmd.aliases = Array.isArray(cmd.aliases) ? cmd.aliases : [];

    cmd.admin = !!cmd.admin;

    cmd.owner = !!cmd.owner;

    cmd.showInMenu = cmd.showInMenu !== false;

    const keyName = normalizeKey(cmd.name);

    map.set(keyName, cmd);

    for (const a of cmd.aliases) map.set(normalizeKey(a), cmd);

    list.push(cmd);

    console.log('✅ Loaded: ' + cmd.name + ' (' + path.relative(COMMANDS_DIR, filePath) + ')');

  };

  for (const filePath of files) {

    try {

      delete require.cache[require.resolve(filePath)];

      const raw = require(filePath);

      register(raw, filePath);

    } catch (e) {

      console.error('❌ Failed loading command:', filePath);

      console.error('   ↳', e?.message || e);

    }

  }

  console.log('📦 Commands loaded: ' + list.length + ' (dir: ' + COMMANDS_DIR + ')');

  return { map, list };

}

let { map: COMMAND_MAP, list: COMMAND_LIST } = loadAllCommands();

// ================================

// 🌐 Text helpers

// ================================

function isChannelLikeJid(jid = '') {

  return jid.endsWith('@newsletter') || jid.endsWith('@broadcast');

}

function getText(message) {

  return (

    message.message?.conversation ||

    message.message?.extendedTextMessage?.text ||

    message.message?.imageMessage?.caption ||

    message.message?.videoMessage?.caption ||

    ''

  );

}

function getSenderId(message) {

  return message.key.participant || message.key.remoteJid;

}

// ================================

// 🔘 Buttons (IDs)

// ================================

const DEFAULT_MENU_BUTTONS = [

  { buttonId: 'help', buttonText: { displayText: '📜 Help / Menu' }, type: 1 },

  { buttonId: 'owner', buttonText: { displayText: '👑 Owner' }, type: 1 },

  { buttonId: 'lang', buttonText: { displayText: '🌐 Language' }, type: 1 }

];

async function sendButtons(sock, chatId, text, quoted) {

  try {

    await sock.sendMessage(

      chatId,

      { text, buttons: DEFAULT_MENU_BUTTONS, headerType: 1 },

      quoted ? { quoted } : undefined

    );

  } catch {

    await sock.sendMessage(chatId, { text }, quoted ? { quoted } : undefined);

  }

}

// ================================

// ✅ Command dispatcher

// ================================

async function runCommand({ sock, message, cmdName, args }) {

  const chatId = message.key.remoteJid;

  const senderId = getSenderId(message);

  const lang = getLang(chatId);

  const TXT = {

    en: {

      noCmd: '❌ Command not found.',

      onlyOwner: '❌ This command is for the owner only.',

      onlyAdmins: '❌ This command is for group admins only.',

      onlyGroups: '❌ This command works in groups only.',

      botNotAdmin: '❌ Please make the bot an admin first.'

    },

    ar: {

      noCmd: '❌ الأمر ده غير موجود.',

      onlyOwner: '❌ الأمر ده للمالك فقط.',

      onlyAdmins: '❌ الأمر ده للأدمنز بس.',

      onlyGroups: '❌ الأمر ده بيشتغل في الجروبات فقط.',

      botNotAdmin: '❌ لازم البوت يبقى أدمن الأول.'

    }

  };

  const T = TXT[lang] || TXT.en;

  const cmd = COMMAND_MAP.get(normalizeKey(cmdName));

  if (!cmd) {

    // (LIGHT LOG) command not found

    console.log(`${sessTag(sock)} [CMD] ❌ not-found: "${cmdName}" chat=${chatId}`);

    // suggest closest

    if (typeof findClosestCommand === 'function') {

      const unique = [...new Set(COMMAND_LIST.map(c => c.name).filter(Boolean))];

      const closest = findClosestCommand(cmdName, unique);

      if (closest) {

        await sendButtons(

          sock,

          chatId,

          `${T.noCmd}\n\n💡 ${lang === 'ar' ? 'هل تقصد' : 'Did you mean'}: *.${closest}* ؟`,

          message

        );

        return;

      }

    }

    await sendButtons(sock, chatId, T.noCmd, message);

    return;

  }

  // Any explicit command should cancel an existing game session in this chat
  // (the new command may start its own session later).
  try { ACTIVE_GAME_SESSIONS.delete(chatId); } catch {}

  // Owner gate

  if (cmd.owner) {

    const ok = await isOwnerOrSudo(senderId, sock, chatId);

    if (!ok) {

      await sock.sendMessage(chatId, { text: T.onlyOwner }, { quoted: message });

      return;

    }

  }

  // Admin gate

  if (cmd.admin) {

    if (!chatId.endsWith('@g.us')) {

      await sock.sendMessage(chatId, { text: T.onlyGroups }, { quoted: message });

      return;

    }

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {

      await sock.sendMessage(chatId, { text: T.botNotAdmin }, { quoted: message });

      return;

    }

    if (!isSenderAdmin && !message.key.fromMe) {

      await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });

      return;

    }

  }

  // auto reaction (no channel forwarding)

  if (typeof addCommandReaction === 'function') {

    try { await addCommandReaction(sock, message); } catch {}

  }

  // ================================

  // ✅ Execute (support old + new command styles)

  // ================================

  const fn = cmd.exec || cmd.run || cmd.execute;

  if (typeof fn !== 'function') {

    console.log(`${sessTag(sock)} [CMD] ❌ no-fn: "${cmd.name}" chat=${chatId}`);

    await sendButtons(sock, chatId, T.noCmd, message);

    return;

  }

  try {

    // 1) New style: (sock, message, args)

    try {

      await fn(sock, message, args);

      if (cmd.gameSession || typeof cmd.onText === 'function' || GAME_SESSION_NAMES.has(cmd.name)) {
        setGameSession(chatId, cmd);
      }

      return;

    } catch (e1) {

      // (LIGHT LOG) only on errors

      console.error(`${sessTag(sock)} [CMD:${cmd.name}] TRY1 FAIL (sock,message,args)`, e1?.stack || e1);

    }

    // 2) Common legacy: (sock, message)

    try {

      await fn(sock, message);

      if (cmd.gameSession || typeof cmd.onText === 'function' || GAME_SESSION_NAMES.has(cmd.name)) {
        setGameSession(chatId, cmd);
      }

      return;

    } catch (e2) {

      console.error(`${sessTag(sock)} [CMD:${cmd.name}] TRY2 FAIL (sock,message)`, e2?.stack || e2);

    }

    // 3) Common legacy: (sock, chatId)

    try {

      await fn(sock, chatId);

      if (cmd.gameSession || typeof cmd.onText === 'function' || GAME_SESSION_NAMES.has(cmd.name)) {
        setGameSession(chatId, cmd);
      }

      return;

    } catch (e3) {

      console.error(`${sessTag(sock)} [CMD:${cmd.name}] TRY3 FAIL (sock,chatId)`, e3?.stack || e3);

    }

    // 4) Old legacy: (sock, chatId, message)

    await fn(sock, chatId, message);

  } catch (e) {

    console.error(`${sessTag(sock)} [CMD:${cmd.name}]`, e?.stack || e);

    const errMsg = lang === 'ar'

      ? '❌ حصل خطأ أثناء تنفيذ الأمر.'

      : '❌ An error occurred while processing your command.';

    await sock.sendMessage(chatId, { text: errMsg }, { quoted: message });

  }

}

// ================================

// 🧠 Main messages handler

// ================================

async function handleMessages(sock, messageUpdate, _printLog = true) {

  const msg = messageUpdate?.messages?.[0];


  // React Raffle: track reactions on active raffles
  if (_rrHandleReactionMessage(msg)) return;
  if (!msg || !msg.message) return;

  // ✅ IMPORTANT: ignore bot's own outgoing messages to prevent loops

  // (Baileys can emit our sent messages back through upsert)

  if (msg.key?.fromMe) return;

  const chatId = msg.key.remoteJid;

  // ignore status + channel/broadcast

  if (chatId === 'status@broadcast') return;

  if (isChannelLikeJid(chatId)) return;

  const senderId = getSenderId(msg);

  if (!chatId.endsWith('@g.us') && pmblocker?.readState) {

    try {

      const state = pmblocker.readState(chatId);

      if (state?.enabled) {

        const okOwner = msg.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);

        if (!okOwner) {

          await sock.sendMessage(chatId, { text: state.message || '' }, { quoted: msg }).catch(() => {});

          return;

        }

      }

    } catch {}

  }

  const body = getText(msg).trim();

  if (!body) return;

  // Baileys buttons

  const buttonId =

    msg.message?.buttonsResponseMessage?.selectedButtonId ||

    msg.message?.templateButtonReplyMessage?.selectedId ||

    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||

    '';

  const prefix = settings.prefix || '.';

  // If user clicked a button with an ID that matches a command

  if (buttonId) {

    // (LIGHT LOG) raw button id

    console.log(`${sessTag(sock)} [BTN] raw="${buttonId}" chat=${chatId}`);

    let id = normalizeKey(buttonId);

    // ✅ FIX: support ids like ".menu"

    const pfx = normalizeKey(prefix);

    if (id.startsWith(pfx)) {

      id = id.slice(pfx.length);

    }

    id = normalizeKey(id);

    if (COMMAND_MAP.has(id)) {

      // (LIGHT LOG) buttons -> commands

      console.log(`${sessTag(sock)} [CMD] 🔘 button="${id}" chat=${chatId}`);

      await runCommand({ sock, message: msg, cmdName: id, args: [] });

    } else {

      console.log(`${sessTag(sock)} [BTN] ❌ not-found id="${id}" (raw="${buttonId}") chat=${chatId}`);

    }

    return;

  }

  // Normal command

  if (!body.startsWith(prefix)) {
    const sessionEntry = ACTIVE_GAME_SESSIONS.get(chatId);
    const sessionCmd = sessionEntry?.cmd;

    // Expire game session automatically
    if (sessionEntry?.expiresAt && Date.now() > sessionEntry.expiresAt) {
      ACTIVE_GAME_SESSIONS.delete(chatId);
    }

    if (sessionCmd && typeof sessionCmd.onText === 'function') {

      const t = body.trim();

      const isExit = /^(exit|quit|end|stop|cancel|خروج|انهاء|إنهاء|الغاء|إلغاء)$/i.test(t);

      if (isExit) {

        ACTIVE_GAME_SESSIONS.delete(chatId);

        const lang = getLang(chatId);

        const txt = lang === 'ar' ? '✅ تم إنهاء اللعبة.' : '✅ Game ended.';

        await sock.sendMessage(chatId, { text: txt }, { quoted: msg }).catch(() => {});

        return;

      }

      await sessionCmd.onText(sock, msg, t);

      if (typeof sessionCmd.isActive === 'function' && !sessionCmd.isActive(chatId)) {

        ACTIVE_GAME_SESSIONS.delete(chatId);

      }

      return;

    }

    // ==========================
    // MENU SELECTION (numbers)
    // - Expires after 60 seconds
    // - Only runs if there's NO active game session
    // ==========================

    try {
      const st = global.__MENU_STATE__;
      const pick = body.trim();
      if (st && st instanceof Map) {
        const s = st.get(chatId);
        const ttl = Math.min(Number(s?.ttl || 60_000) || 60_000, 60_000);
        const isFresh = s?.at && Date.now() - s.at <= ttl;

        // auto-expire stale menu
        if (!isFresh) {
          st.delete(chatId);
        } else if (/^\d+$/.test(pick)) {
          // route menu selection to help handler
          await runCommand({
            sock,
            message: msg,
            cmdName: 'help',
            args: [pick]
          });
          return;
        }
      }
    } catch {}

    return;

  }

  // Close menu session as soon as ANY command is received
  try {
    const st = global.__MENU_STATE__;
    if (st && st instanceof Map) st.delete(chatId);
    else if (st && typeof st === 'object') delete st[chatId];
  } catch {}

  const without = body.slice(prefix.length).trim();

  const parts = without.split(/\s+/);

  const cmdName = parts.shift() || '';

  const args = parts;

  // (LIGHT LOG) commands only

  console.log(`${sessTag(sock)} [CMD] ▶ "${cmdName}" args=${JSON.stringify(args)} chat=${chatId}`);

  await runCommand({ sock, message: msg, cmdName, args });

}

// ================================

// 🧩 Optional events (keep index.js compatible)

// ================================

let _groupHandler = null;

let _statusHandler = null;

try { _groupHandler = require('./lib/groupParticipants'); } catch {}

try { _statusHandler = require('./lib/statusHandler'); } catch {}

async function handleGroupParticipantUpdate(sock, update) {

  try {

    if (typeof _groupHandler === 'function') return await _groupHandler(sock, update);

    if (_groupHandler && typeof _groupHandler.handleGroupParticipantUpdate === 'function') {

      return await _groupHandler.handleGroupParticipantUpdate(sock, update);

    }

  } catch (e) {

    console.error(`${sessTag(sock)} Error in handleGroupParticipantUpdate:`, e?.stack || e);

  }

}

async function handleStatus(sock, status) {

  try {

    if (typeof _statusHandler === 'function') return await _statusHandler(sock, status);

    if (_statusHandler && typeof _statusHandler.handleStatus === 'function') {

      return await _statusHandler.handleStatus(sock, status);

    }

  } catch (e) {

    console.error(`${sessTag(sock)} Error in handleStatus:`, e?.stack || e);

  }

}

module.exports = {

  handleMessages,

  handleGroupParticipantUpdate,

  handleStatus

};

