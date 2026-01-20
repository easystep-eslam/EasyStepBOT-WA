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
    restart: ar ? '♻️ جارِ إعادة التشغيل...' : '♻️ Restarting now...',
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

  // لازم جروب
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

  const senderAdmin =
    typeof isSenderAdmin === 'boolean'
      ? isSenderAdmin
      : !!adminStatus?.isSenderAdmin

  if (!senderAdmin && !message?.key?.fromMe) {
    await safeReact(sock, chatId, message?.key, '🚫')
    await sock.sendMessage(chatId, { text: T.needSenderAdmin }, { quoted: message })
    return
  }

  // بداية التحديث
  await safeReact(sock, chatId, message?.key, '🔄')

  const sent = await sock.sendMessage(
    chatId,
    { text: T.start },
    { quoted: message }
  ).catch(() => null)

  if (!sent?.key) return

  // 30%
  await sock.sendMessage(chatId, {
    text: T.p1,
    edit: sent.key
  }).catch(() => {})

  // تنفيذ التحديث
  exec(
    'bash ./update.sh',
    { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 },
    async (err) => {

      if (err) {
        await sock.sendMessage(chatId, {
          text: T.fail,
          edit: sent.key
        }).catch(() => {})
        return
      }

      // 70%
      await sock.sendMessage(chatId, {
        text: T.p2,
        edit: sent.key
      }).catch(() => {})

      // الرسالة النهائية (مضمونة)
      await sock.sendMessage(chatId, {
        text: `${T.done}\n${T.restart}`,
        edit: sent.key
      }).catch(() => {})

      // نسيب وقت للرسالة تثبت قبل الريستارت
      setTimeout(() => {
        process.exit(0)
      }, 3000)
    }
  )
}

module.exports = {
  name: 'update',
  commands: ['update'],
  aliases: ['upd', 'upgrade', 'تحديث'],

  category: {
    ar: '🤖 أدوات EasyStep',
    en: '🤖 Easystep Tools'
  },
  description: {
    ar: 'تحديث EasyStep-BOT من GitHub وإعادة التشغيل.',
    en: 'Update EasyStep-BOT from GitHub and restart.'
  },
  usage: {
    ar: '.update',
    en: '.update'
  },
  emoji: '🔄',
  admin: true,
  owner: false,
  showInMenu: true,

  run: (sock, chatId, message, args) =>
    handle(sock, chatId, message, args),

  exec: (sock, message, args) =>
    handle(sock, message?.key?.remoteJid, message, args),

  execute: (sock, message, args) =>
    handle(sock, message?.key?.remoteJid, message, args)
}
