const axios = require('axios')

const getApi = require('../../lib/api')

const { getLang } = require('../../lib/lang')

const api = getApi()

async function safeReact(sock, chatId, key, emoji) {

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } })

  } catch {}

}

function extractPackage(input) {

  const text = String(input || '').trim()

  if (!text) return null

  const m = text.match(/[?&]id=([a-zA-Z0-9._]+)/)

  if (m?.[1]) return m[1]

  if (/^[a-zA-Z0-9._]+$/.test(text)) return text

  return null

}

function isHtmlResponse(contentType, buf) {

  const ct = String(contentType || '').toLowerCase()

  if (ct.includes('text/html') || ct.includes('text/plain')) return true

  if (!buf || buf.length < 20) return false

  const head = buf.slice(0, 200).toString('utf8').toLowerCase()

  return head.includes('<!doctype') || head.includes('<html') || head.includes('<head')

}

function guessExtFromHeaders(contentType, disposition) {

  const ct = String(contentType || '').toLowerCase()

  const cd = String(disposition || '')

  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)

  if (m?.[1]) {

    const name = decodeURIComponent(m[1])

    const ext = name.split('.').pop()

    if (ext && ext.length <= 6) return ext.toLowerCase()

  }

  if (ct.includes('application/vnd.android.package-archive')) return 'apk'

  if (ct.includes('application/zip')) return 'zip'

  if (ct.includes('application/octet-stream')) return 'apk'

  return 'apk'

}

async function fetchBinary(url) {

  const res = await axios.get(url, {

    responseType: 'arraybuffer',

    timeout: 180000,

    maxBodyLength: Infinity,

    maxContentLength: Infinity,

    validateStatus: () => true

  })

  return {

    status: res.status,

    buf: Buffer.from(res.data || []),

    contentType: res.headers?.['content-type'],

    disposition: res.headers?.['content-disposition']

  }

}

async function callLolhuman(pkg) {

  const endpoints = ['/apkdownloader', '/api/apkdownloader']

  let lastErr = null

  for (const ep of endpoints) {

    try {

      const { data } = await api.get(ep, { params: { package: pkg } })

      return data

    } catch (e) {

      lastErr = e

      const status = e?.response?.status

      if (status && status !== 404) break

    }

  }

  throw lastErr || new Error('LoLHuman request failed')

}

async function apkCommand(sock, message, text) {

  const chatId = message.key.remoteJid

  const lang = getLang(chatId)

  const TXT = {

    ar: {

      need: '❌ ابعت رابط Play Store أو اسم الباكدج.',

      searching: '⏳ جاري جلب معلومات التطبيق...',

      failed: '❌ فشل تحميل التطبيق.',

      sending: '📦 جاري محاولة إرسال ملف التطبيق...',

      linkOnly: '⚠️ ماقدرتش أجيب ملف مباشر. ده رابط التحميل:',

      done: '✅ تم.'

    },

    en: {

      need: '❌ Send Play Store link or package name.',

      searching: '⏳ Fetching app info...',

      failed: '❌ Failed to download app.',

      sending: '📦 Trying to send the app file...',

      linkOnly: "⚠️ Couldn't fetch a direct file. Here is the download link:",

      done: '✅ Done.'

    }

  }

  const T = TXT[lang] || TXT.ar

  try {

    await safeReact(sock, chatId, message.key, '📦')

    const pkg = extractPackage(text)

    if (!pkg) {

      await sock.sendMessage(chatId, { text: T.need }, { quoted: message })

      await safeReact(sock, chatId, message.key, '❌')

      return

    }

    await sock.sendMessage(chatId, { text: T.searching }, { quoted: message })

    const data = await callLolhuman(pkg)

    const r = data?.result || data

    const appName = r?.title || r?.name || pkg

    const version = r?.version || '-'

    const size = r?.size || '-'

    const url = r?.link || r?.url || r?.download

    if (!url || typeof url !== 'string') throw new Error('No URL')

    const info =

      lang === 'ar'

        ? `📦 الاسم: ${appName}\n🧩 الباكدج: ${pkg}\n🏷️ الإصدار: ${version}\n📏 الحجم: ${size}\n🔗 الرابط: ${url}`

        : `📦 Name: ${appName}\n🧩 Package: ${pkg}\n🏷️ Version: ${version}\n📏 Size: ${size}\n🔗 Link: ${url}`

    await sock.sendMessage(chatId, { text: info }, { quoted: message })

    await sock.sendMessage(chatId, { text: T.sending }, { quoted: message })

    const { status, buf, contentType, disposition } = await fetchBinary(url)

    const MAX = 45 * 1024 * 1024

    const bad = status >= 400 || !buf?.length || isHtmlResponse(contentType, buf) || buf.length > MAX

    if (bad) {

      await sock.sendMessage(chatId, { text: `${T.linkOnly}\n${url}` }, { quoted: message })

      await safeReact(sock, chatId, message.key, '✅')

      return

    }

    const ext = guessExtFromHeaders(contentType, disposition)

    const fileName = `${pkg}.${ext}`

    await sock.sendMessage(

      chatId,

      {

        document: buf,

        mimetype: ext === 'apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream',

        fileName,

        caption: T.done

      },

      { quoted: message }

    )

    await safeReact(sock, chatId, message.key, '✅')

  } catch (e) {

    console.error('[APK]', e?.response?.status || e?.message || e)

    await safeReact(sock, chatId, message.key, '❌')

    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message })

  }

}

module.exports = {

  name: {

    ar: 'تحميل_تطبيق',

    en: 'apk'

  },

  aliases: ['apk', 'apkdl', 'playapk', 'تحميل_تطبيق', 'تطبيق'],

  category: {

    ar: '🤖 أدوات EasyStep',

    en: '🤖 Easystep Tools'

  },

  description: {

    ar: 'تحميل تطبيقات أندرويد من Play Store (رابط + إرسال ملف إذا كان مباشر).',

    en: 'Download Android apps from Play Store (link + send file if direct).'

  },

  usage: {

    ar: '.تحميل_تطبيق (اسم الباكدج أو رابط بلاي ستور)',

    en: '.apk (package name or Play Store link)'

  },

  emoji: '📦',

  admin: true,

  owner: false,

  showInMenu: true,

  run: apkCommand,

  exec: apkCommand,

  execute: apkCommand

}