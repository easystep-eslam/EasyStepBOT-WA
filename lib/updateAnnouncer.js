const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const settings = require('../settings');
const { getLang } = require('../lib/lang');

const CHANGELOG_JSON = path.join(process.cwd(), 'data', 'changelog.json');
const UPDATE_MSG_JSON = path.join(process.cwd(), 'data', 'update_message.json');

const SENT_STATE = path.join(process.cwd(), 'data', 'last_update_sent.json');
const PENDING_PATH = path.join(process.cwd(), 'data', 'pending_update_announce.json');

function ensureDir(p) {
  try {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function readJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8') || 'null');
  } catch {
    return null;
  }
}

function writeJSON(p, obj) {
  try {
    ensureDir(p);
    fs.writeFileSync(p, JSON.stringify(obj || {}, null, 2));
  } catch {}
}

function safeUnlink(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function normalizeJid(jid = '') {
  return String(jid).split(':')[0];
}

// fallback recipients (if group fetch fails)
function getFallbackRecipients() {
  const rec = [];
  const candidates = [
    settings.updateAnnounceChatId,
    settings.updateChatId,
    settings.announceChatId,
    settings.logGroup,
    settings.logsGroup,
    settings.botGroup,
    settings.groupId,
    settings.groupJid
  ].filter(Boolean);

  if (candidates.length) {
    rec.push(String(candidates[0]));
    return rec;
  }

  const ownerNum = String(settings.ownerNumber || '').replace(/\D/g, '');
  if (ownerNum) rec.push(ownerNum + '@s.whatsapp.net');
  return rec;
}

function buildFromUpdateMessageFile(chatId) {
  const cfgAll = readJSON(UPDATE_MSG_JSON);
  if (!cfgAll) return null;

  const lang = getLang(chatId) === 'ar' ? 'ar' : 'en';
  const cfg = cfgAll?.[lang];
  if (!cfg) return null;

  // supports either {text:"..."} OR {title, header, points:[]}
  if (typeof cfg.text === 'string' && cfg.text.trim()) {
    return cfg.text.trim();
  }

  const title = String(cfg.title || '').trim();
  const header = String(cfg.header || '').trim();
  const points = Array.isArray(cfg.points) ? cfg.points.map(x => String(x || '').trim()).filter(Boolean) : [];

  if (!title && !header && !points.length) return null;

  const lines = [];
  if (title) lines.push(title);
  lines.push('');
  if (header) lines.push(header);
  for (const p of points) lines.push(`• ${p}`);

  return lines.join('\n').trim();
}

function buildFromChangelog(ch) {
  const version = String(ch?.version || '').trim();
  const date = String(ch?.date || '').trim();
  const changes = Array.isArray(ch?.changes) ? ch.changes.map(s => String(s).trim()).filter(Boolean) : [];

  if (!version && !changes.length) return null;

  const key = version ? `v:${version}` : `ch:${String(date || '').trim() || 'unknown'}`;

  const lines = [];
  lines.push('🤖 EasyStep-BOT — Update');
  if (version) lines.push(`📦 Version: ${version}`);
  if (date) lines.push(`🗓 Date: ${date}`);
  lines.push('');
  lines.push('🆕 الجديد / What’s new:');
  for (const c of changes.slice(0, 12)) lines.push(`• ${c}`);

  return { key, text: lines.join('\n') };
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch {
    return '';
  }
}

function buildFromGit() {
  const head = safeExec('git rev-parse --short HEAD');
  const subjectsRaw = safeExec('git log -n 8 --pretty=%s');
  const subjects = subjectsRaw
    .split('\n')
    .map(s => String(s).trim())
    .filter(Boolean)
    .filter(s => !s.toLowerCase().startsWith('merge'));

  if (!head && !subjects.length) return null;

  const key = head ? `commit:${head}` : `git:${Date.now()}`;
  const lines = [];
  lines.push('🤖 EasyStep-BOT — Update');
  if (head) lines.push(`🔖 Commit: ${head}`);
  lines.push('');
  lines.push('🆕 Latest changes (GitHub):');
  for (const s of subjects.slice(0, 8)) lines.push(`• ${s}`);

  return { key, text: lines.join('\n') };
}

async function isBotAdminInGroup(sock, groupId) {
  try {
    const meta = await sock.groupMetadata(groupId);
    const botJid = normalizeJid(sock?.user?.id || sock?.user?.jid || '');
    if (!botJid) return false;

    const me = (meta?.participants || []).find(p => normalizeJid(p.id) === botJid);
    return !!(me && me.admin); // admin or superadmin
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function announceUpdateIfNeeded(sock, { delayMs = 2000 } = {}) {
  // Gate: only announce after .update created the pending flag
  const pending = readJSON(PENDING_PATH);
  if (!pending) return false;

  // Key used to prevent repeating the same announcement
  let key = '';
  // Message will be language-specific per group; we still need a stable key
  const ch = readJSON(CHANGELOG_JSON);
  if (ch && String(ch?.version || '').trim()) key = `v:${String(ch.version).trim()}`;
  if (!key) {
    const head = safeExec('git rev-parse --short HEAD');
    key = head ? `commit:${head}` : `time:${Date.now()}`;
  }

  const prev = readJSON(SENT_STATE) || {};
  if (prev.lastKey === key) {
    safeUnlink(PENDING_PATH);
    return false;
  }

  // Try broadcast to groups where bot is admin
  let groups = [];
  try {
    const all = await sock.groupFetchAllParticipating();
    groups = Object.keys(all || {}).filter(Boolean);
  } catch {
    groups = [];
  }

  // If we can’t fetch groups, fallback to configured recipients or the group that ran .update
  if (!groups.length) {
    const fallbackList = getFallbackRecipients();
    const also = pending?.chatId ? [String(pending.chatId)] : [];
    const targets = Array.from(new Set([...also, ...fallbackList])).filter(Boolean);

    for (const to of targets) {
      try {
        const msg = buildFromUpdateMessageFile(to) || buildFromChangelog(ch)?.text || buildFromGit()?.text;
        if (!msg) continue;
        await sock.sendMessage(String(to), { text: msg });
      } catch {}
    }

    writeJSON(SENT_STATE, { lastKey: key, sentAt: Date.now() });
    safeUnlink(PENDING_PATH);
    return true;
  }

  // Broadcast: only groups where bot is admin
  for (const gid of groups) {
    const ok = await isBotAdminInGroup(sock, gid);
    if (!ok) continue;

    const msg = buildFromUpdateMessageFile(gid) || buildFromChangelog(ch)?.text || buildFromGit()?.text;
    if (!msg) continue;

    try {
      await sock.sendMessage(gid, { text: msg });
    } catch {}

    await sleep(delayMs);
  }

  writeJSON(SENT_STATE, { lastKey: key, sentAt: Date.now() });
  safeUnlink(PENDING_PATH);
  return true;
}

module.exports = { announceUpdateIfNeeded };