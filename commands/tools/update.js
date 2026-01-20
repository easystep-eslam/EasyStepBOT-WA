const { exec } = require('child_process')

const isAdmin = require('../../lib/isAdmin')
const { getLang } = require('../../lib/lang')

function TXT(chatId) {
  const ar = getLang(chatId) === 'ar'
  return {
    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command can only be used in groups.',
    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',
    needSenderAdmin: ar ? '❌ الأمر ده للأدمن فقط.' : '❌ Only group admins can use this command.',

    start: ar ? '⏳ جارِ تحديث EasyStep-BOT...' : '⏳ Updating EasyStep-BOT...',
    p1: ar ? '🔄 جاري تنزيل التحديث... (30%)' : '🔄 Downloading update... (30%)',
    p2: ar ? '📦 جاري تثبيت التحديث... (70%)' : '📦 Installing update... (70%)',
    done: ar ? '✅ تم التحديث بنجاح.' : '✅ Update completed successfully.',
    fail: ar ? '❌ فشل التحديث.' : '❌ Update failed.'
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

  // react start
  await safeReact(sock, chatId, message?.key, '🔄')

  // send initial message
  const sent = await sock.sendMessage(
    chatId,
    { text: T.start },
    { quoted: message }
  )

  // fake progress (edit same message)
  setTimeout(() => {
    sock.sendMessage(chatId, { text: T.p1, edit: sent.key }).catch(() => {})
  }, 3000)

  setTimeout(() => {
    sock.sendMessage(chatId, { text: T.p2, edit: sent.key }).catch(() => {})
  }, 6000)

  exec('bash ./update.sh', { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 }, async (err) => {
    if (err) {
      await safeReact(sock, chatId, message?.key, '❌')
      await sock.sendMessage(chatId, { text: T.fail, edit: sent.key }).catch(() => {})
      return
    }

    await safeReact(sock, chatId, message?.key, '✅')
    await sock.sendMessage(chatId, { text: T.done, edit: sent.key }).catch(() => {})
    setTimeout(() => process.exit(0), 1200)
  })
}

module.exports = {
  name: 'update',
  commands: ['update'],
  aliases: ['upd', 'upgrade'],

  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  description: {
    ar: 'تحديث EasyStep-BOT وإعادة التشغيل.',
    en: 'Update EasyStep-BOT and restart.'
  },
  usage: {
    ar: '.update',
    en: '.update'
  },
  emoji: '🔄',
  admin: true,
  owner: false,
  showInMenu: true,

  run: (sock, chatId, message, args) => handle(sock, chatId, message, args),
  exec: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args),
  execute: (sock, message, args) => handle(sock, message?.key?.remoteJid, message, args)
}
