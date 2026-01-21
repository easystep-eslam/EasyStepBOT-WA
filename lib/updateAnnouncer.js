const fs = require('fs')
const path = require('path')
const { getLang } = require('./lang')

const CHANGELOG_JSON = path.join(process.cwd(), 'data', 'changelog.json')
const SENT_STATE = path.join(process.cwd(), 'data', 'last_update_sent.json')

function ensureDir(filePath) {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  } catch {}
}

function readJSON(p) {
  try {
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8') || 'null')
  } catch {
    return null
  }
}

function writeJSON(p, obj) {
  try {
    ensureDir(p)
    fs.writeFileSync(p, JSON.stringify(obj || {}, null, 2))
  } catch {}
}

function pickTextForChat(chatId, ch) {
  const ar = getLang(chatId) === 'ar'
  const arText = typeof ch?.ar === 'string' ? ch.ar.trim() : ''
  const enText = typeof ch?.en === 'string' ? ch.en.trim() : ''
  return (ar ? arText : enText) || arText || enText || null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getAllGroupJids(sock) {
  try {
    const all = await sock.groupFetchAllParticipating()
    return Object.keys(all || {}).filter((j) => String(j).endsWith('@g.us'))
  } catch {
    return []
  }
}

async function broadcastChangelogToAllGroups(sock, opts = {}) {
  const ch = readJSON(CHANGELOG_JSON)
  if (!ch) return { ok: false, reason: 'no_changelog' }

  const key = String(ch?.key || '').trim()
  if (!key) return { ok: false, reason: 'no_key' }

  const state = readJSON(SENT_STATE) || {}
  const sentMap = state.lastKeyByChat && typeof state.lastKeyByChat === 'object'
    ? state.lastKeyByChat
    : {}

  const groups = await getAllGroupJids(sock)
  const alsoTo = Array.isArray(opts.alsoTo) ? opts.alsoTo : []
  const targets = [...new Set([...groups, ...alsoTo])].filter(Boolean)

  let sentCount = 0

  for (const jid of targets) {
    // لو نفس التحديث اتبعت قبل كده للجروب ده -> تجاهل
    if (sentMap[jid] === key) continue

    const text = pickTextForChat(jid, ch)
    if (!text) continue

    try {
      await sock.sendMessage(jid, { text })
      sentMap[jid] = key
      sentCount++
      await sleep(350) // تهدئة بسيطة لتفادي rate limit
    } catch {}
  }

  writeJSON(SENT_STATE, { ...state, lastKeyByChat: sentMap, lastKey: key, sentAt: Date.now() })
  return { ok: sentCount > 0, key, sentCount }
}

module.exports = { broadcastChangelogToAllGroups }