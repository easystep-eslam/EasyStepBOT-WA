const settings = require('../../settings')

const isAdmin = require('../../lib/isAdmin')
const { getLang } = require('../../lib/lang')
const { hasUpdate } = require('../../lib/updateChecker')

function TXT(chatId) {
  const ar = getLang(chatId) === 'ar'
  return {
    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command can only be used in groups.',
    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',
    needSenderAdmin: ar ? '❌ الأمر ده للأدمن فقط.' : '❌ Only group admins can use this command.',
    yes: ar ? '✅ يوجد تحديث جديد للبوت. برجاء استخدام (.update) للتحديث.' : '✅ A new update is available. Please use (.update) to update.',
    no: ar ? '✅ أنت على آخر إصدار.' : '✅ You are on the latest version.',
    repo: ar ? 'المستودع' : 'Repository'
  }
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } })
  } catch {}
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

  await safeReact(sock, chatId, message?.key, '🧩')

  const upd = await hasUpdate().catch(() => false)
  const repo = settings.github || settings.updateZipUrl || ''

  const text = upd
    ? `${T.yes}${repo ? `\n${T.repo}: ${repo}` : ''}`
    : `${T.no}${repo ? `\n${T.repo}: ${repo}` : ''}`

  await sock.sendMessage(chatId, { text }, { quoted: message }).catch(() => {})
}

module.exports = {
  name: 'checkupdate',
  commands: ['checkupdate'],
  aliases: ['cu', 'updatecheck'],

  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  description: {
    ar: 'فحص وجود تحديث للبوت.',
    en: 'Check if there is an available update for the bot.'
  },
  usage: {
    ar: '.checkupdate',
    en: '.checkupdate'
  },
  emoji: '🧩',
  admin: true,
  owner: false,
  showInMenu: true,

  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),
  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),
  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args)
}
