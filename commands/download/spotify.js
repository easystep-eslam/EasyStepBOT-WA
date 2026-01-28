const { getLang } = require('../../lib/lang')
const getApi = require('../../lib/api')

const api = getApi()

function safeFileName(name) {
  return String(name || 'track')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function getRawText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  ).trim()
}

async function safeReact(sock, chatId, key, emoji) {
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } })
  } catch {}
}

function extractQuery(message, args = []) {
  let q = Array.isArray(args) && args.length ? args.join(' ').trim() : ''
  if (q) return q

  const raw = getRawText(message)
  const used = (raw.split(/\s+/)[0] || '.spotify').trim()
  q = raw.slice(used.length).trim()
  return q
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

function pickFirstTrack(data) {
  const r = data?.result

  if (r && typeof r === 'object' && !Array.isArray(r)) return r

  if (Array.isArray(r) && r.length) return r[0]
  if (Array.isArray(data?.data) && data.data.length) return data.data[0]
  if (Array.isArray(data?.results) && data.results.length) return data.results[0]

  return null
}

function pickAudioUrl(track) {
  if (!track || typeof track !== 'object') return ''
  const candidates = [
    track.audio,
    track.audio_url,
    track.audioUrl,
    track.download,
    track.download_url,
    track.downloadUrl,
    track.url_audio,
    track.mp3,
    track.link,
    track.link_download,
    track.play,
    track.play_url
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return ''
}

function pickThumb(track) {
  const candidates = [
    track.thumbnails,
    track.thumbnail,
    track.thumb,
    track.cover,
    track.image,
    track.poster
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  if (Array.isArray(track.images) && track.images[0]?.url) return track.images[0].url
  if (Array.isArray(track.thumbnail) && track.thumbnail[0]) return track.thumbnail[0]
  return ''
}

function pickMeta(track) {
  const title = track?.title || track?.name || ''
  const artist =
    track?.artist ||
    track?.artists?.[0]?.name ||
    (Array.isArray(track?.artists) ? track.artists.join(', ') : '') ||
    ''
  const duration = track?.duration || track?.duration_ms || track?.durationMs || ''
  const url = track?.url || track?.track_url || track?.trackUrl || track?.link || ''
  const size = track?.size || track?.filesize || ''
  return { title, artist, duration, url, size }
}

async function spotifyCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid
  const lang = getLang(chatId)

  const TXT = {
    en: {
      usage:
        '🎧 Spotify Downloader\n\n' +
        'Usage:\n' +
        '.spotify <song / artist / keywords>\n\n' +
        'Examples:\n' +
        '.spotify con calma\n' +
        '.spotify eminem lose yourself\n' +
        '.spotify ya habibi\n',
      searching: (q) => `🔎 Searching Spotify for: *${q}* ...`,
      found: (title, artist) => `✅ Found:\n🎵 ${title}\n👤 ${artist}`,
      noAudio: '❌ No downloadable audio found for this track.',
      failed: '❌ Failed to fetch Spotify audio. Try again later.',
      caption: (r) =>
        `🎵 ${r.title || r.name || 'Unknown Title'}\n` +
        `👤 ${r.artist || 'Unknown Artist'}\n` +
        `⏱ ${r.duration || 'Unknown'}\n` +
        `🔗 ${r.url || ''}`
    },
    ar: {
      usage:
        '🎧 تحميل من سبوتيفاي\n\n' +
        'الاستخدام:\n' +
        '.spotify <اسم الأغنية / المطرب / كلمات>\n\n' +
        'أمثلة:\n' +
        '.spotify con calma\n' +
        '.spotify عمرو دياب\n' +
        '.spotify ya habibi\n',
      searching: (q) => `🔎 بدوّر في سبوتيفاي على: *${q}* ...`,
      found: (title, artist) => `✅ لقيت:\n🎵 ${title}\n👤 ${artist}`,
      noAudio: '❌ مفيش ملف صوتي متاح للأغنية دي.',
      failed: '❌ فشل تحميل الأغنية من سبوتيفاي، جرّب تاني بعد شوية.',
      caption: (r) =>
        `🎵 ${r.title || r.name || 'اسم غير معروف'}\n` +
        `👤 ${r.artist || 'فنان غير معروف'}\n` +
        `⏱ ${r.duration || 'غير معروف'}\n` +
        `🔗 ${r.url || ''}`
    }
  }

  const T = TXT[lang] || TXT.en

  try {
    await safeReact(sock, chatId, message.key, '🎧')

    const query = extractQuery(message, args)
    if (!query) {
      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message })
      return
    }

    await sock.sendMessage(chatId, { text: T.searching(query) }, { quoted: message })

    const data = await tryLolhuman(
      ['/api/spotify', '/api/spotify2', '/api/search/spotify', '/api/spotifysearch', '/api/downloader/spotify'],
      { q: query, query, search: query, keyword: query }
    )

    const track = pickFirstTrack(data)
    if (!track) throw new Error('No result from LoLHuman')

    const meta = pickMeta(track)
    const title = meta.title || (lang === 'ar' ? 'اسم غير معروف' : 'Unknown Title')
    const artist = meta.artist || (lang === 'ar' ? 'فنان غير معروف' : 'Unknown Artist')

    const audioUrl = pickAudioUrl(track)
    if (!audioUrl) {
      await safeReact(sock, chatId, message.key, '❌')
      await sock.sendMessage(chatId, { text: T.noAudio }, { quoted: message })
      return
    }

    await sock.sendMessage(chatId, { text: T.found(title, artist) }, { quoted: message })

    const thumb = pickThumb(track)
    const caption = String(
      (T.caption({
        title,
        artist,
        duration: meta.duration || (lang === 'ar' ? 'غير معروف' : 'Unknown'),
        url: meta.url || ''
      }) || '')
    ).trim()

    if (thumb) {
      await sock.sendMessage(chatId, { image: { url: thumb }, caption }, { quoted: message })
    } else if (caption) {
      await sock.sendMessage(chatId, { text: caption }, { quoted: message })
    }

    const fileName = `${safeFileName(title)}.mp3`

    await sock.sendMessage(
      chatId,
      { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName, ptt: false },
      { quoted: message }
    )

    await safeReact(sock, chatId, message.key, '✅')
  } catch (error) {
    console.error('[SPOTIFY] error:', error?.message || error)
    await sock.sendMessage(
      chatId,
      { text: T.failed || (lang === 'ar' ? '❌ حصل خطأ.' : '❌ Error.') },
      { quoted: message }
    )
    await safeReact(sock, chatId, message.key, '❌')
  }
}

module.exports = {
  name: 'spotify',
  aliases: ['spotify', 'sp', 'سبوتيفاي'],
  category: {
    ar: '📥 أوامر التحميل',
    en: '📥 Download Commands'
  },
  description: {
    ar: 'تحميل أغاني من سبوتيفاي بالبحث بالكلمات.',
    en: 'Download Spotify tracks by searching keywords.'
  },
  usage: {
    ar: '.spotify <اسم الأغنية / المطرب / كلمات>',
    en: '.spotify <song / artist / keywords>'
  },
  emoji: '🎧',
  admin: true,
  owner: false,
  showInMenu: true,
  run: spotifyCommand,
  exec: spotifyCommand,
  execute: spotifyCommand
}
