const fs = require('fs')
const path = require('path')

const isAdmin = require('../../lib/isAdmin')
const { getLang } = require('../../lib/lang')

const DB_PATH = path.join(process.cwd(), 'data', 'muteusers.json')

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  )
}

function normalizeJid(jid = '') {
  return String(jid).split(':')[0]
}

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {}
    const raw = fs.readFileSync(DB_PATH, 'utf8')
    const data = JSON.parse(raw || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function writeDB(db) {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(db || {}, null, 2))
  } catch {}
}

function parseDurationToMs(input) {
  if (input === undefined || input === null) return null
  const str = String(input).trim().toLowerCase()
  if (!str) return null

  if (/^\d+$/.test(str)) {
    const n = Number(str)
    if (!Number.isFinite(n) || n <= 0) return NaN
    return Math.floor(n) * 60 * 1000
  }

  const m = str.match(/^(\d+)(m|h|d)$/)
  if (!m) return NaN

  const value = Number(m[1])
  const unit = m[2]
  if (!Number.isFinite(value) || value <= 0) return NaN

  if (unit === 'm') return value * 60 * 1000
  if (unit === 'h') return value * 60 * 60 * 1000
  if (unit === 'd') return value * 24 * 60 * 60 * 1000

  return NaN
}

function msToLeft(ms, ar) {
  if (!Number.isFinite(ms) || ms <= 0) return ar ? 'انتهى' : 'expired'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)

  const parts = []
  if (d) parts.push(ar ? `${d} يوم` : `${d}d`)
  if (h) parts.push(ar ? `${h} ساعة` : `${h}h`)
  if (m || !parts.length) parts.push(ar ? `${m} دقيقة` : `${m}m`)
  return parts.join(ar ? ' و ' : ' ')
}

/**
 * ✅ target from:
 * - mention (priority)
 * - reply (extendedTextMessage.contextInfo.participant)
 */
function pickTargetJid(message) {
  const ctx = message?.message?.extendedTextMessage?.contextInfo

  // 1) Mention
  const arr = ctx?.mentionedJid
  if (Array.isArray(arr) && arr.length) return normalizeJid(arr[0])

  // 2) Reply
  const p = ctx?.participant
  if (p) return normalizeJid(p)

  return null
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } })
  } catch {}
}

function TXT(chatId) {
  const ar = getLang(chatId) === 'ar'
  return {
    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command can only be used in groups.',
    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',
    needSenderAdmin: ar ? '❌ الأمر ده للأدمن فقط.' : '❌ Only group admins can use this command.',

    menu: ar
      ? '🔇 قائمة muteuser\n\n• لكتم عضو:\n  .muteuser @member 30\n  .muteuser @member 2h\n  .muteuser @member 3d\n\n• لفك الكتم:\n  .unmuteuser @member\n\n• عرض المكتومين:\n  .muted\n\nملاحظة: الرقم فقط = بالدقائق'
      : '🔇 muteuser Menu\n\n• Mute a member:\n  .muteuser @member 30\n  .muteuser @member 2h\n  .muteuser @member 3d\n\n• Unmute:\n  .unmuteuser @member\n\n• List muted:\n  .muted\n\nNote: number only = minutes',

    needMention: ar ? '❌ منشن العضو أو اعمل ريبلاي على رسالته.' : '❌ Mention a member or reply to their message.',
    needTime: ar ? '❌ اكتب مدة (مثال: 30 أو 2h أو 3d).' : '❌ Provide a duration (e.g., 30 or 2h or 3d).',
    badTime: ar ? '❌ مدة غير صحيحة. استخدم 30 / 2h / 3d.' : '❌ Invalid duration. Use 30 / 2h / 3d.',
    added: (left) => (ar ? `✅ تم كتم العضو. المدة المتبقية: ${left}` : `✅ Member muted. Time left: ${left}`),
    removed: ar ? '✅ تم فك الكتم.' : '✅ Unmuted successfully.',
    notMuted: ar ? 'ℹ️ العضو مش مكتوم.' : 'ℹ️ Member is not muted.',
    listEmpty: ar ? 'ℹ️ مفيش حد مكتوم حاليًا.' : 'ℹ️ No muted members right now.',
    listTitle: ar ? '🔇 قائمة المكتومين:' : '🔇 Muted members:',
    err: ar ? '❌ حصل خطأ. جرّب تاني.' : '❌ An error occurred. Please try again.'
  }
}

function cleanupExpired(db, chatId) {
  const now = Date.now()
  const group = db?.[chatId]
  if (!group || typeof group !== 'object') return db

  let changed = false
  for (const jid of Object.keys(group)) {
    const rec = group[jid]
    if (!rec || !rec.until || rec.until <= now) {
      delete group[jid]
      changed = true
    }
  }
  if (changed) {
    if (!Object.keys(group).length) delete db[chatId]
  }
  return db
}

async function handle(sock, chatId, message, args = [], senderId, isSenderAdmin) {
  if (!chatId) return
  const T = TXT(chatId)

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message?.key, '❌')
    await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message })
    return
  }

  const realSenderId = senderId || message?.key?.participant || chatId
  const adminStatus = await isAdmin(sock, chatId, realSenderId).catch(() => null)

  if (!adminStatus?.isBotAdmin) {
    await safeReact(sock, chatId, message?.key, '❌')
    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message })
    return
  }

  const senderAdmin = typeof isSenderAdmin === 'boolean' ? isSenderAdmin : !!adminStatus?.isSenderAdmin
  if (!senderAdmin && !message?.key?.fromMe) {
    await safeReact(sock, chatId, message?.key, '🚫')
    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message })
    return
  }

  const raw = getText(message).trim()
  const used = (raw.split(/\s+/)[0] || '').toLowerCase()
  const cmd = used.startsWith('.') ? used.slice(1) : used

  const inferredArgs =
    Array.isArray(args) && args.length ? args : raw.slice(used.length).trim().split(/\s+/).filter(Boolean)

  if (!inferredArgs.length && (cmd === 'muteuser' || cmd === 'كتم_عضو' || cmd === 'كتم')) {
    await safeReact(sock, chatId, message?.key, 'ℹ️')
    await sock.sendMessage(chatId, { text: T.menu }, { quoted: message })
    return
  }

  // ✅ mention OR reply
  const targetJid = pickTargetJid(message)

  let db = readDB()
  db = cleanupExpired(db, chatId)
  writeDB(db)

  if (cmd === 'muted' || cmd === 'المكتومين') {
    const group = db?.[chatId] || {}
    const now = Date.now()
    const keys = Object.keys(group)

    if (!keys.length) {
      await safeReact(sock, chatId, message?.key, 'ℹ️')
      await sock.sendMessage(chatId, { text: T.listEmpty }, { quoted: message })
      return
    }

    const ar = getLang(chatId) === 'ar'
    const lines = keys.map((jid, i) => {
      const left = msToLeft((group[jid]?.until || 0) - now, ar)
      return `${i + 1}) @${jid.replace(/\D/g, '')} — ${left}`
    })

    await safeReact(sock, chatId, message?.key, '🔇')
    await sock.sendMessage(
      chatId,
      { text: `${T.listTitle}\n\n${lines.join('\n')}`, mentions: keys },
      { quoted: message }
    )
    return
  }

  if (cmd === 'unmuteuser' || cmd === 'فك_كتم' || cmd === 'فك' || cmd === 'unmute') {
    if (!targetJid) {
      await safeReact(sock, chatId, message?.key, '❌')
      await sock.sendMessage(chatId, { text: T.needMention }, { quoted: message })
      return
    }

    if (!db[chatId] || !db[chatId][targetJid]) {
      await safeReact(sock, chatId, message?.key, 'ℹ️')
      await sock.sendMessage(chatId, { text: T.notMuted }, { quoted: message })
      return
    }

    delete db[chatId][targetJid]
    if (!Object.keys(db[chatId]).length) delete db[chatId]
    writeDB(db)

    await safeReact(sock, chatId, message?.key, '✅')
    await sock.sendMessage(chatId, { text: T.removed }, { quoted: message })
    return
  }

  if (cmd === 'muteuser' || cmd === 'كتم_عضو' || cmd === 'كتم') {
    if (!targetJid) {
      await safeReact(sock, chatId, message?.key, '❌')
      await sock.sendMessage(chatId, { text: T.needMention }, { quoted: message })
      return
    }

    const durArg = inferredArgs[0] && String(inferredArgs[0]).startsWith('@') ? inferredArgs[1] : inferredArgs[0]
    if (!durArg) {
      await safeReact(sock, chatId, message?.key, '❌')
      await sock.sendMessage(chatId, { text: T.needTime }, { quoted: message })
      return
    }

    const ms = parseDurationToMs(durArg)
    if (Number.isNaN(ms) || !ms) {
      await safeReact(sock, chatId, message?.key, '❌')
      await sock.sendMessage(chatId, { text: T.badTime }, { quoted: message })
      return
    }

    const now = Date.now()
    const until = now + ms

    if (!db[chatId]) db[chatId] = {}
    db[chatId][targetJid] = {
      until,
      by: normalizeJid(realSenderId),
      at: now
    }
    writeDB(db)

    const ar = getLang(chatId) === 'ar'
    const left = msToLeft(until - now, ar)

    await safeReact(sock, chatId, message?.key, '🔇')
    await sock.sendMessage(
      chatId,
      { text: T.added(left), mentions: [targetJid] },
      { quoted: message }
    )
    return
  }

  await safeReact(sock, chatId, message?.key, 'ℹ️')
  await sock.sendMessage(chatId, { text: T.menu }, { quoted: message })
}

module.exports = {
  name: 'muteuser',
  commands: ['muteuser', 'unmuteuser', 'muted'],
  aliases: ['كتم_عضو', 'فك_كتم', 'المكتومين', 'كتم', 'فك'],
  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  description: {
    ar: 'كتم عضو (وهميًا) بالدقائق/الساعات/الأيام + عرض وفك الكتم.',
    en: 'Fake-mute a member with minutes/hours/days + list & unmute.'
  },
  usage: {
    ar: '.muteuser @عضو 30 | 2h | 3d\n.unmuteuser @عضو\n.muted',
    en: '.muteuser @member 30 | 2h | 3d\n.unmuteuser @member\n.muted'
  },
  emoji: '🔇',
  admin: true,
  owner: false,
  showInMenu: true,
  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),
  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),
  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),
  readDB,
  writeDB
  }
