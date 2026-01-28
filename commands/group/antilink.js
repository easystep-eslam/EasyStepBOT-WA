const { setAntilink, getAntilink, removeAntilink } = require('../../lib/index')
const isAdmin = require('../../lib/isAdmin')
const { getLang } = require('../../lib/lang')

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  )
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } })
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId)
  const base = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botNeedAdmin: '❌ Please make the bot an admin first.',
      adminOnly: '❌ This command is for group admins only.',
      help:
        '*ANTILINK*\n\n' +
        '• .antilink on (WhatsApp/Telegram/Facebook only)\n' +
        '• .antilink all on (Any links)\n' +
        '• .antilink off\n' +
        '• .antilink set delete | kick | warn\n' +
        '• .antilink get\n\n' +
        'Note: Default action is *delete*.',
      alreadyOn: '*_Antilink is already ON_*',
      alreadyOff: '*_Antilink is already OFF_*',
      turnedOn: (scope) => `*_Antilink has been turned ON (${scope})_*`,
      turnedOff: '*_Antilink has been turned OFF_*',
      setNeedAction: '*_Please specify: .antilink set delete | kick | warn_*',
      invalidAction: '*_Invalid action. Choose delete, kick, or warn._*',
      setOk: (a) => `*_Antilink action set to: ${a}_*`,
      config: (enabled, act, scope) =>
        `*_Antilink Configuration:_*\nStatus: ${enabled ? 'ON' : 'OFF'}\nAction: ${act || 'Not set'}\nScope: ${scope || 'social'}`,
      failedOn: '*_Failed to turn ON Antilink_*',
      failedSet: '*_Failed to set Antilink action_*',
      warnText: (u) => `⚠️ Warning @${u}: links are not allowed here.`,
      kickedText: (u) => `🚫 @${u} has been kicked for sending links.`,
      error: '❌ Error processing antilink command.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botNeedAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      adminOnly: '❌ الأمر ده لمشرفين الجروب فقط.',
      help:
        '*منع الروابط*\n\n' +
        '• .antilink on (واتساب/تليجرام/فيسبوك فقط)\n' +
        '• .antilink all on (أي روابط)\n' +
        '• .antilink off\n' +
        '• .antilink set delete | kick | warn\n' +
        '• .antilink get\n\n' +
        'ملحوظة: الإجراء الافتراضي هو *delete*.',
      alreadyOn: '*_منع الروابط مفعل بالفعل_*',
      alreadyOff: '*_منع الروابط متوقف بالفعل_*',
      turnedOn: (scope) => `*_تم تفعيل منع الروابط (${scope})_*`,
      turnedOff: '*_تم إيقاف منع الروابط_*',
      setNeedAction: '*_حدد الإجراء: .antilink set delete | kick | warn_*',
      invalidAction: '*_إجراء غير صحيح. اختر: delete أو kick أو warn._*',
      setOk: (a) => `*_تم ضبط إجراء منع الروابط إلى: ${a}_*`,
      config: (enabled, act, scope) =>
        `*_إعدادات منع الروابط:_*\nالحالة: ${enabled ? 'مفعل' : 'غير مفعل'}\nالإجراء: ${act || 'غير محدد'}\nالنطاق: ${scope || 'social'}`,
      failedOn: '*_فشل تفعيل منع الروابط_*',
      failedSet: '*_فشل ضبط إجراء منع الروابط_*',
      warnText: (u) => `⚠️ تحذير @${u}: ممنوع إرسال الروابط هنا.`,
      kickedText: (u) => `🚫 تم طرد @${u} بسبب إرسال روابط.`,
      error: '❌ حصل خطأ أثناء تنفيذ أمر منع الروابط.'
    }
  }
  return { lang, T: base[lang] || base.en }
}

function parseArgs(message, args) {
  const raw = String(getText(message) || '').trim()
  const first = (raw.split(/\s+/)[0] || 'antilink').toLowerCase()

  let text = Array.isArray(args) && args.length ? args.join(' ').trim() : ''
  if (!text) text = raw.slice(first.length).trim()

  const parts = String(text || '').trim().split(/\s+/).filter(Boolean)

  let scope = 'social'
  let action = (parts[0] || '').toLowerCase()
  let more = parts.slice(1)

  if (action === 'all') {
    scope = 'all'
    action = (parts[1] || '').toLowerCase()
    more = parts.slice(2)
  }

  return { scope, action, more }
}

async function antilinkCommand(sock, message, args = []) {
  const chatId = message?.key?.remoteJid
  if (!chatId) return

  const senderId = message?.key?.participant || message?.key?.remoteJid || chatId
  const { T } = TXT(chatId)

  await safeReact(sock, chatId, message?.key, '🔗')

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message?.key, '❌')
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message })
    return
  }

  const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId)

  if (!isBotAdmin) {
    await safeReact(sock, chatId, message?.key, '❌')
    await sock.sendMessage(chatId, { text: T.botNeedAdmin }, { quoted: message })
    return
  }

  if (!isSenderAdmin && !message?.key?.fromMe) {
    await safeReact(sock, chatId, message?.key, '🚫')
    await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message })
    return
  }

  try {
    const { scope, action, more } = parseArgs(message, args)

    if (!action) {
      await safeReact(sock, chatId, message?.key, 'ℹ️')
      await sock.sendMessage(chatId, { text: T.help }, { quoted: message })
      return
    }

    if (action === 'on') {
      const cfg = await getAntilink(chatId, 'on')
      if (cfg?.enabled) {
        await safeReact(sock, chatId, message?.key, 'ℹ️')
        await sock.sendMessage(chatId, { text: T.alreadyOn }, { quoted: message })
        return
      }

      const ok = await setAntilink(chatId, 'on', 'delete')
      if (ok) await setAntilink(chatId, 'scope', scope)

      await safeReact(sock, chatId, message?.key, ok ? '✅' : '❌')
      const scopeLabel =
        scope === 'all'
          ? (getLang(chatId) === 'ar' ? 'أي روابط' : 'any links')
          : (getLang(chatId) === 'ar' ? 'واتساب/تليجرام/فيسبوك' : 'WhatsApp/Telegram/Facebook')

      await sock.sendMessage(chatId, { text: ok ? T.turnedOn(scopeLabel) : T.failedOn }, { quoted: message })
      return
    }

    if (action === 'off') {
      const cfg = await getAntilink(chatId, 'on')
      if (!cfg?.enabled) {
        await safeReact(sock, chatId, message?.key, 'ℹ️')
        await sock.sendMessage(chatId, { text: T.alreadyOff }, { quoted: message })
        return
      }

      await removeAntilink(chatId, 'on')
      await removeAntilink(chatId, 'scope')

      await safeReact(sock, chatId, message?.key, '⛔')
      await sock.sendMessage(chatId, { text: T.turnedOff }, { quoted: message })
      return
    }

    if (action === 'set') {
      const setAction = (more[0] || '').toLowerCase()

      if (!setAction) {
        await safeReact(sock, chatId, message?.key, 'ℹ️')
        await sock.sendMessage(chatId, { text: T.setNeedAction }, { quoted: message })
        return
      }

      if (!['delete', 'kick', 'warn'].includes(setAction)) {
        await safeReact(sock, chatId, message?.key, '❌')
        await sock.sendMessage(chatId, { text: T.invalidAction }, { quoted: message })
        return
      }

      const ok = await setAntilink(chatId, 'on', setAction)

      await safeReact(sock, chatId, message?.key, ok ? '✅' : '❌')
      await sock.sendMessage(chatId, { text: ok ? T.setOk(setAction) : T.failedSet }, { quoted: message })
      return
    }

    if (action === 'get') {
      const cfg = await getAntilink(chatId, 'on')
      const sc = await getAntilink(chatId, 'scope')

      const enabled = !!cfg?.enabled
      const act = cfg?.action || ''
      const scopeVal = (sc?.scope || sc?.value || sc?.action || sc) || 'social'

      await safeReact(sock, chatId, message?.key, 'ℹ️')
      await sock.sendMessage(chatId, { text: T.config(enabled, act, scopeVal) }, { quoted: message })
      return
    }

    await safeReact(sock, chatId, message?.key, 'ℹ️')
    await sock.sendMessage(chatId, { text: T.help }, { quoted: message })
  } catch (e) {
    console.error('[ANTILINK]', e?.message || e)
    await safeReact(sock, chatId, message?.key, '❌')
    await sock.sendMessage(chatId, { text: TXT(chatId).T.error }, { quoted: message })
  }
}

async function handleLinkDetection(sock, chatId, message, _userMessage, senderId) {
  try {
    const cfg = await getAntilink(chatId, 'on')
    if (!cfg?.enabled) return

    if (message?.key?.fromMe) return

    const userMessage = getText(message)
    if (!userMessage) return

    const sc = await getAntilink(chatId, 'scope')
    const scopeVal = (sc?.scope || sc?.value || sc?.action || sc) || 'social'

    const ANY_LINKS = /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i
    const SOCIAL_LINKS =
      /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|telegram\.org|facebook\.com|fb\.watch|m\.facebook\.com)\S*/i

    const tester = scopeVal === 'all' ? ANY_LINKS : SOCIAL_LINKS
    if (!tester.test(String(userMessage))) return

    const { isBotAdmin, isSenderAdmin } = await isAdmin(sock, chatId, senderId)

    if (isSenderAdmin) return
    if (!isBotAdmin) return

    const action = (cfg?.action || 'delete').toLowerCase()

    try {
      if (message?.key) await sock.sendMessage(chatId, { delete: message.key })
    } catch {}

    const { T } = TXT(chatId)
    const senderNum = String(senderId || '').split('@')[0]

    if (action === 'kick') {
      try {
        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove')
      } catch {}
      try {
        await sock.sendMessage(chatId, { text: T.kickedText(senderNum), mentions: [senderId] }, { quoted: message })
      } catch {}
      return
    }

    if (action === 'warn') {
      try {
        await sock.sendMessage(chatId, { text: T.warnText(senderNum), mentions: [senderId] }, { quoted: message })
      } catch {}
      return
    }
  } catch (e) {
    console.error('[ANTILINK DETECT]', e?.message || e)
  }
}

module.exports = {
  name: 'antilink',
  aliases: ['antilink', 'منع_الروابط', 'منع_روابط'],
  category: {
    ar: '🛠️ إدارة الجروب',
    en: '🛠️ Group Management'
  },
  description: {
    ar: 'منع إرسال الروابط داخل الجروب مع تحديد الإجراء (حذف/تحذير/طرد).',
    en: 'Prevents sending links in the group with configurable action (delete/warn/kick).'
  },
  usage: {
    ar: '.antilink on | all on | off | set delete|warn|kick | get',
    en: '.antilink on | all on | off | set delete|warn|kick | get'
  },
  emoji: '🔗',
  admin: true,
  owner: false,
  showInMenu: true,
  run: antilinkCommand,
  exec: antilinkCommand,
  execute: antilinkCommand,
  antilinkCommand,
  handleLinkDetection
}