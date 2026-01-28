const { ttdl } = require('ruhend-scraper')
const axios = require('axios')
const { getLang } = require('../../lib/lang')
const getApi = require('../../lib/api')

const api = getApi()
const processedMessages = new Set()

function getRawText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  ).trim()
}

function extractUrlFromText(text = '') {
  const m = String(text || '').match(/https?:\/\/\S+/i)
  return m ? m[0].trim() : ''
}

function isValidTikTokUrl(url = '') {
  const patterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\//i,
    /https?:\/\/(?:vm\.)?tiktok\.com\//i,
    /https?:\/\/(?:vt\.)?tiktok\.com\//i
  ]
  return patterns.some((p) => p.test(url))
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } })
  } catch {}
}

function T(chatId) {
  const lang = getLang(chatId)
  const TXT = {
    en: {
      usage:
        '🎵 TikTok Downloader\n\n' +
        'Usage:\n' +
        '.tiktok <link>\n.tik <link>\n.tt <link>\n\n' +
        'Example:\n' +
        '.tt https://www.tiktok.com/@user/video/123',
      invalidLink: 'That is not a valid TikTok link.',
      wait: '⏳ Please wait… downloading now.',
      failAll:
        '❌ Failed to download TikTok video.\n' +
        'Try another link or check if the video is available.',
      caption: (title) =>
        `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧\n\n📝 Title: ${title || 'TikTok Video'}`
    },
    ar: {
      usage:
        '🎵 تحميل تيك توك\n\n' +
        'الاستخدام:\n' +
        '.tiktok <لينك>\n.tik <لينك>\n.tt <لينك>\n\n' +
        'مثال:\n' +
        '.tt https://www.tiktok.com/@user/video/123',
      invalidLink: 'ده مش لينك تيك توك صحيح.',
      wait: '⏳ استنى شوية… جاري التحميل.',
      failAll:
        '❌ فشل تحميل فيديو التيك توك.\n' +
        'جرّب لينك تاني أو اتأكد إن الفيديو متاح.',
      caption: (title) =>
        `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗘𝗔𝗦𝗬𝗦𝗧𝗘𝗣-𝗕𝗢𝗧\n\n📝 العنوان: ${title || 'فيديو تيك توك'}`
    }
  }
  return { lang, TXT: TXT[lang] || TXT.en }
}

function extractUrl(message, args = []) {
  let url = (Array.isArray(args) && args.length ? args.join(' ') : '').trim()
  if (url) return url
  const raw = getRawText(message)
  url = extractUrlFromText(raw)
  return url
}

async function tryLolhuman(paths, params) {
  let lastErr
  for (const p of paths) {
    try {
      const { data } = await api.get(p, { params })
      return data
    } catch (e) {
      lastErr = e
      const status = e?.response?.status
      if (status && status !== 404) break
    }
  }
  throw lastErr || new Error('LoLHuman request failed')
}

function pickFirstObj(val) {
  if (!val) return null
  if (Array.isArray(val)) return val[0] || null
  if (typeof val === 'object') return val
  return null
}

function pickTiktokTitle(result) {
  return (
    result?.title ||
    result?.description ||
    result?.desc ||
    result?.caption ||
    result?.metadata?.title ||
    'TikTok Video'
  )
}

function pickTiktokVideoUrl(result) {
  const candidates = [
    result?.nowm,
    result?.no_watermark,
    result?.noWatermark,
    result?.video_nowm,
    result?.videoNowm,
    result?.video,
    result?.mp4,
    result?.link,
    result?.url,
    result?.play,
    result?.download,
    result?.download_url
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  if (Array.isArray(result?.links)) {
    const x = result.links.find((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
    if (x) return x
  }
  return null
}

function pickTiktokAudioUrl(result) {
  const candidates = [
    result?.audio,
    result?.music,
    result?.music_url,
    result?.audio_url,
    result?.mp3,
    result?.aac
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

function pickBestFromTtdl(mediaData = []) {
  const items = Array.isArray(mediaData) ? mediaData : []
  let videoUrl = null
  let audioUrl = null

  const videos = items.filter((x) => x?.type === 'video' && typeof x.url === 'string')
  const audios = items.filter((x) => x?.type === 'audio' && typeof x.url === 'string')

  if (videos.length) {
    const hd = videos.find((v) => /hd|high/i.test(String(v.quality || v.resolution || ''))) || videos[0]
    videoUrl = hd.url
  }

  if (audios.length) {
    const best = audios.find((a) => /mp3|m4a|aac/i.test(String(a.format || a.ext || ''))) || audios[0]
    audioUrl = best.url
  }

  if (typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) videoUrl = null
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) audioUrl = null

  return { videoUrl, audioUrl }
}

async function tiktokCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid
  const { lang, TXT } = T(chatId)

  try {
    const msgId = message?.key?.id
    if (msgId) {
      if (processedMessages.has(msgId)) return
      processedMessages.add(msgId)
      setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000)
    }

    const url = extractUrl(message, args)
    if (!url) {
      await sock.sendMessage(chatId, { text: TXT.usage }, { quoted: message })
      return
    }

    if (!isValidTikTokUrl(url)) {
      await sock.sendMessage(chatId, { text: TXT.invalidLink }, { quoted: message })
      return
    }

    await safeReact(sock, chatId, message.key, '🎵')
    await sock.sendMessage(chatId, { text: TXT.wait }, { quoted: message })

    let title = null
    let videoUrl = null
    let audioUrl = null

    try {
      const data = await tryLolhuman(
        [
          '/api/tiktok',
          '/api/tiktok2',
          '/api/tiktokdl',
          '/api/tiktoknowm',
          '/api/downloader/tiktok'
        ],
        { url }
      )

      const result = pickFirstObj(data?.result) || pickFirstObj(data?.data) || pickFirstObj(data) || null
      if (result) {
        title = pickTiktokTitle(result)
        videoUrl = pickTiktokVideoUrl(result)
        audioUrl = pickTiktokAudioUrl(result)
      }
    } catch {}

    if (!videoUrl) {
      try {
        const downloadData = await ttdl(url).catch(() => null)
        const mediaData = downloadData?.data || []
        const picked = pickBestFromTtdl(mediaData)
        videoUrl = picked.videoUrl
        audioUrl = audioUrl || picked.audioUrl
        if (!title) {
          title =
            downloadData?.title ||
            downloadData?.result?.title ||
            downloadData?.data?.[0]?.title ||
            'TikTok Video'
        }
      } catch {}
    }

    if (!videoUrl) {
      await safeReact(sock, chatId, message.key, '❌')
      await sock.sendMessage(chatId, { text: TXT.failAll }, { quoted: message })
      return
    }

    const caption = TXT.caption(title)

    try {
      await sock.sendMessage(
        chatId,
        { video: { url: videoUrl }, mimetype: 'video/mp4', caption },
        { quoted: message }
      )
    } catch {
      const buf = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 90000 })
      await sock.sendMessage(
        chatId,
        { video: Buffer.from(buf.data), mimetype: 'video/mp4', caption },
        { quoted: message }
      )
    }

    if (audioUrl) {
      const audioName = lang === 'ar' ? 'tiktok_audio.mp3' : 'tiktok_audio.mp3'
      try {
        await sock.sendMessage(
          chatId,
          { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: audioName, ptt: false },
          { quoted: message }
        )
      } catch {}
    }

    await safeReact(sock, chatId, message.key, '✅')
  } catch (error) {
    console.error('[TIKTOK] error:', error?.message || error)
    await safeReact(sock, chatId, message.key, '❌')
    const { TXT } = T(chatId)
    await sock.sendMessage(chatId, { text: TXT.failAll }, { quoted: message })
  }
}

module.exports = {
  name: 'tiktok',
  aliases: ['tiktok', 'tik', 'tt', 'تيك', 'تيكتوك'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل فيديو تيك توك من الرابط.',
    en: 'Download TikTok videos from a link.'
  },
  usage: {
    ar: '.tt <لينك تيك توك>',
    en: '.tt <tiktok link>'
  },
  emoji: '🎬',
  admin: true,
  owner: false,
  showInMenu: true,
  run: tiktokCommand,
  exec: tiktokCommand,
  execute: tiktokCommand,
  tiktokCommand
}