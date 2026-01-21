const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const isAdmin = require('../../lib/isAdmin')
const { getLang } = require('../../lib/lang')

function TXT(chatId) {
  const ar = getLang(chatId) === 'ar'
  return {
    onlyGroup: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command can only be used in groups.',
    needBotAdmin: ar ? '❌ لازم تخلي البوت أدمن الأول.' : '❌ Please make the bot an admin first.',
    needSenderAdmin: ar ? '❌ الأمر ده للأدمن فقط.' : '❌ Only group admins can use this command.',

    starting: ar ? '⏳ جارِ تحديث EasyStep-BOT...' : '⏳ Updating EasyStep-BOT...',
    progress: (p) => (ar ? `🔄 جاري تنزيل التحديث... (%${p})` : `🔄 Downloading update... (${p}%)`),

    done1: ar ? '✅ تم التحديث بنجاح.' : '✅ Update completed successfully.',
    done2: ar ? '♻️ جارِ إعادة التشغيل...' : '♻️ Restarting...',

    fail: ar ? '❌ فشل التحديث.' : '❌ Update failed.'
  }
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } })
  } catch {}
}

// Baileys edit message helper
async function editText(sock, chatId, keyToEdit, text) {
  if (!keyToEdit) return
  try {
    await sock.sendMessage(chatId, { text, edit: keyToEdit })
  } catch {}
}

function stopIndexWatcherBeforeUpdate() {
  // index.js عندك عامل fs.watchFile(__filename) وده بيعمل reload أثناء git pull
  // هنا بنوقفه قبل التحديث عشان مايحصلش restart عند 30%
  try {
    const entry =
      (require.main && require.main.filename) ||
      process.argv[1] ||
      path.join(process.cwd(), 'index.js')

    if (entry) {
      fs.unwatchFile(entry)
    }
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

  await safeReact(sock, chatId, message?.key, '🔄')

  // رسالة واحدة هنعدلها (progress وهمي)
  const sent = await sock.sendMessage(chatId, { text: T.starting }, { quoted: message }).catch(() => null)
  const editKey = sent?.key

  // وقف watcher بتاع index.js قبل ما يبدأ التحديث
  stopIndexWatcherBeforeUpdate()

  let p = 10
  let finished = false

  const tick = setInterval(() => {
    if (finished) return
    if (p < 90) p += 10
    editText(sock, chatId, editKey, T.progress(p)).catch(() => {})
  }, 900)

  exec('bash ./update.sh', { timeout: 8 * 60 * 1000, maxBuffer: 1024 * 1024 }, async (err, stdout, stderr) => {
    finished = true
    clearInterval(tick)

    if (err) {
      const details = String(stderr || err.message || '').trim().slice(0, 1200)
      const msg = `${T.fail}${details ? `\n\n${details}` : ''}`
      await safeReact(sock, chatId, message?.key, '❌')
      await editText(sock, chatId, editKey, msg)
      return
    }

    await safeReact(sock, chatId, message?.key, '✅')

    // عدّل نفس الرسالة لنجاح + ريستارت
    await editText(sock, chatId, editKey, `${T.done1}\n${T.done2}`)

    // ادي وقت للرسالة تتبعت/تتعدل وبعدين اخرج عشان Pterodactyl يعيد التشغيل
    setTimeout(() => process.exit(0), 2000)
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
    ar: 'تحديث البوت من GitHub وإعادة التشغيل.',
    en: 'Update the bot from GitHub and restart.'
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
