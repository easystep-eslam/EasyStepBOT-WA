const fs = require('fs');

const path = require('path');

const { getLang } = require('./lang');

const PENDING_FILE = path.join(process.cwd(), 'data', 'pending_promote.json');

function ensureFile() {

  const dir = path.dirname(PENDING_FILE);

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(PENDING_FILE)) fs.writeFileSync(PENDING_FILE, JSON.stringify({}, null, 2));

}

function readPending() {

  try {

    ensureFile();

    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8') || '{}') || {};

  } catch {

    return {};

  }

}

function writePending(data) {

  try {

    ensureFile();

    fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));

    return true;

  } catch {

    return false;

  }

}

function popPending(groupId, jid) {

  const data = readPending();

  const arr = Array.isArray(data[groupId]) ? data[groupId] : [];

  const had = arr.includes(jid);

  if (!had) return false;

  const next = arr.filter(x => x !== jid);

  if (next.length) data[groupId] = next;

  else delete data[groupId];

  writePending(data);

  return true;

}

function T(chatId) {

  const lang = getLang(chatId);

  const TXT = {

    en: {

      promoted: '👑 Auto-promotion completed.',

      promoteFailed: '❌ Auto-promotion failed.'

    },

    ar: {

      promoted: '👑 تم تنفيذ الترقية التلقائية بنجاح.',

      promoteFailed: '❌ فشلت الترقية التلقائية.'

    }

  };

  return TXT[lang] || TXT.en;

}

function safeRequireHandlers() {

  let welcomeHandler = null;

  let goodbyeHandler = null;

  try {

    const welcome = require('../commands/group/welcome');

    if (typeof welcome?.handleJoinEvent === 'function') welcomeHandler = welcome.handleJoinEvent;

  } catch {}

  try {

    const goodbye = require('../commands/group/goodbye');

    if (typeof goodbye?.handleLeaveEvent === 'function') goodbyeHandler = goodbye.handleLeaveEvent;

  } catch {}

  return { welcomeHandler, goodbyeHandler };

}

async function handleGroupParticipantUpdate(sock, update) {

  try {

    const groupId = update?.id || update?.jid;

    const participants = Array.isArray(update?.participants) ? update.participants : [];

    const action = String(update?.action || update?.type || '').toLowerCase();

    if (!groupId || !participants.length || !action) return;

    const { welcomeHandler, goodbyeHandler } = safeRequireHandlers();

    if (action === 'add' && welcomeHandler) {

      try {

        await welcomeHandler(sock, groupId, participants);

      } catch (e) {

        console.error('welcome handler error:', e);

      }

    }

    if (action === 'remove' && goodbyeHandler) {

      try {

        await goodbyeHandler(sock, groupId, participants);

      } catch (e) {

        console.error('goodbye handler error:', e);

      }

    }

    if (action !== 'add') return;

    const TXT = T(groupId);

    for (const jid of participants) {

      const id = String(jid || '');

      if (!id) continue;

      const shouldPromote = popPending(groupId, id);

      if (!shouldPromote) continue;

      try {

        await sock.groupParticipantsUpdate(groupId, [id], 'promote');

        await sock.sendMessage(groupId, { text: TXT.promoted, mentions: [id] }).catch(() => {});

      } catch {

        await sock.sendMessage(groupId, { text: TXT.promoteFailed, mentions: [id] }).catch(() => {});

      }

    }

  } catch (e) {

    console.error('groupParticipants error:', e);

  }

}

module.exports = { handleGroupParticipantUpdate };