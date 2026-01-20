const { exec } = require('child_process')
const settings = require('../../settings')
const { getLang } = require('../../lib/lang')

function isOwner(sender) {
  const n = String(settings.ownerNumber || '').replace(/\D/g, '')
  if (!n) return false
  return String(sender || '').includes(n)
}

async function updateCommand(sock, message) {
  const chatId = message.key.remoteJid
  const sender = message.key.participant || message.key.remoteJid
  const lang = getLang(chatId)

  const TXT = {
    en: {
      react: '🔄',
      onlyOwner: '❌ This command is for the owner only.',
      start: '⏳ Updating EasyStep-BOT...',
      p1: '🔄 Downloading update... (30%)',
      p2: '📦 Installing update... (70%)',
      done: '✅ Update completed successfully.',
      fail: '❌ Update failed.'
    },
    ar: {
      react: '🔄',
      onlyOwner: '❌ الأمر ده للمالك فقط.',
      start: '⏳ جارِ تحديث EasyStep-BOT...',
      p1: '🔄 جاري تنزيل التحديث... (30%)',
      p2: '📦 جاري تثبيت التحديث... (70%)',
      done: '✅ تم التحديث بنجاح.',
      fail: '❌ فشل التحديث.'
    }
  }

  const T = TXT[lang] || TXT.en

  if (!isOwner(sender)) {
    await sock.sendMessage(chatId, { text: T.onlyOwner }, { quoted: message })
    return
  }

  // React
  await sock.sendMessage(chatId, {
    react: { text: T.react, key: message.key }
  }).catch(() => {})

  // Send initial message
  const sent = await sock.sendMessage(
    chatId,
    { text: T.start },
    { quoted: message }
  )

  // Fake progress (edit same message)
  setTimeout(() => {
    sock.sendMessage(chatId, {
      text: T.p1,
      edit: sent.key
    }).catch(() => {})
  }, 3000)

  setTimeout(() => {
    sock.sendMessage(chatId, {
      text: T.p2,
      edit: sent.key
    }).catch(() => {})
  }, 6000)

  // Run update
  exec('bash ./update.sh', { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 }, async (err, stdout, stderr) => {
    if (err) {
      await sock.sendMessage(chatId, {
        text: T.fail,
        edit: sent.key
      }).catch(() => {})
      return
    }

    // Final edit
    await sock.sendMessage(chatId, {
      text: T.done,
      edit: sent.key
    }).catch(() => {})

    setTimeout(() => process.exit(0), 1200)
  })
}

module.exports = {
  name: 'update',
  aliases: ['upd', 'تحديث'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  emoji: '🔄',
  admin: true,
  owner: false,
  showInMenu: true,
  exec: updateCommand
}
