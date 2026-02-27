const axios = require('axios')

const yts = require('yt-search')

const { toAudio } = require('../../lib/converter')

const { getLang } = require('../../lib/lang')

const getApi = require('../../lib/api')

// API instances

let lolhumanApi = null

let autoresApi = null

try { lolhumanApi = getApi('lolhuman') } catch (e) { console.log('[LOLHUMAN INIT FAIL]', e.message) }

try { autoresApi = getApi('autoresbot') } catch (e) { console.log('[AUTORESBOT INIT FAIL]', e.message) }

async function safeReact(sock, chatId, key, emoji) {
  try { await sock.sendMessage(chatId, { react: { text: emoji, key } }) } catch {}
}

async function safeSend(sock, chatId, payload, opts) {
  try { return await sock.sendMessage(chatId, payload, opts) } catch (e) {
    console.error('[SEND FAIL]', e?.message || e)
  }
}

function extractQuery(message, args = []) {
  if (args.length) return args.join(' ').trim()
  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    ''
  const cmd = text.split(/\s+/)[0]
  return text.slice(cmd.length).trim()
}

function isYouTubeUrl(text) {
  return /youtu\.be|youtube\.com/i.test(text)
}

function safeFileName(name) {
  return String(name || 'song')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

async function trySource(fn, name) {
  try {
    const res = await fn()
    if (!res?.download) throw new Error('NO_LINK')
    return res
  } catch (e) {
    const status = e?.response?.status
    const data = e?.response?.data
    console.error(`[${name} FAIL]`, status || e.message, data || '')
    return null
  }
}

/* ===================== ✅ AUTORESBOT (YTPLAY) ===================== */

async function getAutoresbot(url) {
  if (!autoresApi) throw new Error('AUTORESBOT_CLIENT_MISSING')

  console.log('[SONG] Trying autoresbot ytplay...')

  // Autoresbot أحيانًا بيرجع "job sedang diproses" بدون رابط
  // فنعمل polling/retry لحد ما يظهر data.url
  const maxRetries = 7
  const delayMs = 9000

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  let last = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const r = await autoresApi.get('/api/downloader/ytplay', {
      params: {
        url,
        format: 'm4a'
      },
      timeout: 90000,
      validateStatus: () => true
    })

    console.log(`[AUTORESBOT STATUS] ${r.status} (try ${attempt}/${maxRetries})`)

    // لو رجع HTML يبقى blocked / cloudflare
    if (typeof r.data === 'string' && /<!doctype html>|<html/i.test(r.data)) {
      console.log('[AUTORESBOT DATA] HTML_BLOCKED')
      throw new Error('AUTORESBOT_BLOCKED_HTML')
    }

    last = r.data
    console.log('[AUTORESBOT DATA]', last)

    if (!last?.status) throw new Error('AUTORESBOT_FAILED')

    const dl = last?.data?.url
    const title = last?.data?.title || 'audio'
    const thumb = last?.data?.thumbnail || null

    // ✅ لو الرابط جاهز
    if (dl && typeof dl === 'string') {
      return { download: dl, title, thumb }
    }

    // ✅ لو لسه تحت المعالجة / أو بيرجع status true بدون url لحظيًا
    const msg = String(last?.message || '').toLowerCase()
    void msg

    if (attempt < maxRetries) {
      await sleep(delayMs)
      continue
    }
  }

  throw new Error('AUTORESBOT_NO_URL')
}

/* ===================== ✅ LOLHUMAN ===================== */

async function getLolhumanAudio(url) {
  if (!lolhumanApi) throw new Error('LOLHUMAN_CLIENT_MISSING')

  console.log('[SONG] Trying lolhuman...')

  const res = await lolhumanApi.get('/api/ytaudio', {
    params: { url },
    timeout: 90000,
    validateStatus: () => true
  })

  console.log('[LOLHUMAN STATUS]', res.status)

  const link = res?.data?.result?.link
  if (!link) throw new Error('LOLHUMAN_NO_LINK')

  return {
    download: link,
    title: res.data.result.title,
    thumb: res.data.result.thumbnail
  }
}

/* ===================== ✅ FALLBACK: YUPRA ===================== */

async function getYupra(url) {
  console.log('[SONG] Trying yupra...')

  const r = await axios.get(
    `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    {
      timeout: 90000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*'
      }
    }
  )

  console.log('[YUPRA STATUS]', r.status)

  if (!r?.data?.success) throw new Error('YUPRA_FAILED')

  return {
    download: r.data.data.download_url,
    title: r.data.data.title,
    thumb: r.data.data.thumbnail
  }
}

/* ===================== MAIN ===================== */

async function songCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid
  const lang = getLang(chatId)

  const T = {
    ar: {
      usage: 'اكتب: .song <اسم الأغنية>',
      searching: q => `🔍 جاري البحث عن: *${q}*`,
      best: t => `⭐ أفضل نتيجة:\n*${t}*`,
      failed: '❌ فشل تحميل/إرسال الصوت من كل المصادر.'
    },
    en: {
      usage: 'Usage: .song <song name>',
      searching: q => `🔍 Searching for: *${q}*`,
      best: t => `⭐ Best match:\n*${t}*`,
      failed: '❌ Failed to download/send audio from all sources.'
    }
  }[lang]

  try {
    await safeReact(sock, chatId, message.key, '🎵')

    const query = extractQuery(message, args)
    if (!query) {
      await safeSend(sock, chatId, { text: T.usage }, { quoted: message })
      return
    }

    let video

    if (isYouTubeUrl(query)) {
      video = { url: query }
    } else {
      const searchingMsg = await safeSend(
        sock,
        chatId,
        { text: T.searching(query) },
        { quoted: message }
      )

      const search = await yts(query)
      if (!search?.videos?.length) throw new Error('NO_RESULTS')

      video = search.videos[0]

      // ✅ رسالة أفضل نتيجة
      await safeSend(sock, chatId, {
        text: T.best(video.title),
        edit: searchingMsg?.key
      })

      // ✅ رسالة الصورة + الكابشن المطلوب
      try {
        const title = video?.title || 'Unknown'
        const artist =
          video?.author?.name ||
          video?.author?.username ||
          video?.author ||
          'Unknown'

        const caption =
          `*${title}*\n` +
          `${artist}\n` +
          `──────────────\n` +
          `> © EasyStep`

        const thumbUrl = video?.thumbnail || video?.image
        if (thumbUrl) {
          await safeSend(
            sock,
            chatId,
            { image: { url: thumbUrl }, caption },
            { quoted: message }
          )
        }
      } catch (e) {
        console.error('[SONG] Thumbnail message failed:', e?.message || e)
      }
    }

    // ✅ ترتيب المصادر
    const audioData =
      (await trySource(() => getAutoresbot(video.url), 'AUTORESBOT')) ||
      (await trySource(() => getLolhumanAudio(video.url), 'LOLHUMAN')) ||
      (await trySource(() => getYupra(video.url), 'YUPRA'))

    if (!audioData) throw new Error('ALL_SOURCES_FAILED')

    console.log('[SONG] Download URL:', audioData.download)

    // ✅ نزّل الملف
    const audioRes = await axios.get(audioData.download, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      validateStatus: () => true
    })

    console.log('[SONG] Download HTTP:', audioRes.status)

    if (audioRes.status !== 200 || !audioRes.data) {
      throw new Error(`DOWNLOAD_FAILED_HTTP_${audioRes.status}`)
    }

    const rawBuffer = Buffer.from(audioRes.data)
    console.log('[SONG] Raw buffer size:', rawBuffer.length)

    // ✅ لو التحويل mp3 فشل، هنرسل m4a مباشرة
    let finalBuffer = rawBuffer
    let mimetype = 'audio/mp4' // m4a
    let fileName = `${safeFileName(audioData.title)}.m4a`

    try {
      const mp3 = await toAudio(rawBuffer, 'mp3')
      if (mp3 && mp3.length > 1000) {
        finalBuffer = mp3
        mimetype = 'audio/mpeg'
        fileName = `${safeFileName(audioData.title)}.mp3`
      } else {
        console.log('[SONG] MP3 conversion small/empty -> sending M4A')
      }
    } catch (e) {
      console.log('[SONG] MP3 conversion failed -> sending M4A:', e.message)
    }

    console.log('[SONG] Final buffer size:', finalBuffer.length, 'mime:', mimetype)

    // ✅ إرسال الصوت
    await safeSend(
      sock,
      chatId,
      {
        audio: finalBuffer,
        mimetype,
        fileName
      },
      { quoted: message }
    )

    await safeReact(sock, chatId, message.key, '✅')
  } catch (err) {
    console.error('[SONG FATAL ERROR]', err)
    await safeReact(sock, chatId, message.key, '❌')
    await safeSend(sock, chatId, { text: T.failed }, { quoted: message })
  }
}

module.exports = {
  name: 'song',
  aliases: ['song', 'play', 'music', 'اغنية', 'أغنية'],
  run: songCommand,
  exec: songCommand,
  execute: songCommand
      }
