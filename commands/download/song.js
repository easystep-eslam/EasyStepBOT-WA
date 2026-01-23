const axios = require('axios')

const yts = require('yt-search')

const fs = require('fs')

const path = require('path')

const getApi = require('../../lib/api')

const { toAudio } = require('../../lib/converter')

const { getLang } = require('../../lib/lang')

const api = getApi()

const AXIOS_DEFAULTS = {

  timeout: 60000,

  headers: {

    'User-Agent':

      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    Accept: 'application/json, text/plain, */*'

  }

}

async function safeReact(sock, chatId, key, emoji) {

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } })

  } catch {}

}

async function tryRequest(getter, attempts = 3) {

  let lastError

  for (let attempt = 1; attempt <= attempts; attempt++) {

    try {

      return await getter()

    } catch (err) {

      lastError = err

      if (attempt < attempts) await new Promise(r => setTimeout(r, 900 * attempt))

    }

  }

  throw lastError

}

async function getLolhumanAudioByUrl(youtubeUrl) {

  const { data } = await api.get('/api/ytaudio2', { params: { url: youtubeUrl } })

  const link = data?.result?.link

  if (!link) throw new Error('No link')

  return {

    download: link,

    title: data.result.title,

    thumbnail: data.result.thumbnail

  }

}

async function getYupraDownloadByUrl(youtubeUrl) {

  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`

  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS))

  if (res?.data?.success && res?.data?.data?.download_url) {

    return {

      download: res.data.data.download_url,

      title: res.data.data.title,

      thumbnail: res.data.data.thumbnail

    }

  }

  throw new Error('Yupra failed')

}

async function getOkatsuDownloadByUrl(youtubeUrl) {

  const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`

  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS))

  if (res?.data?.dl) {

    return {

      download: res.data.dl,

      title: res.data.title,

      thumbnail: res.data.thumb

    }

  }

  throw new Error('Okatsu failed')

}

function safeFileName(name) {

  return String(name || 'song')

    .replace(/[\\/:*?"<>|]/g, '')

    .replace(/\s+/g, ' ')

    .trim()

    .slice(0, 80)

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

  return /https?:\/\/\S+/.test(text) && (text.includes('youtube.com') || text.includes('youtu.be'))

}

async function downloadToBuffer(url) {

  const res = await axios.get(url, {

    responseType: 'arraybuffer',

    timeout: 90000,

    headers: { 'User-Agent': 'Mozilla/5.0' }

  })

  return Buffer.from(res.data)

}

function detectAudioExt(buffer) {

  if (buffer.slice(0, 3).toString() === 'ID3') return 'mp3'

  if (buffer.slice(0, 4).toString() === 'OggS') return 'ogg'

  if (buffer.slice(0, 4).toString() === 'RIFF') return 'wav'

  return 'm4a'

}

async function songCommand(sock, message, args = []) {

  const chatId = message.key.remoteJid

  const lang = getLang(chatId)

  const T = {

    ar: {

      usage: 'الاستخدام: .song <اسم الأغنية>',

      searching: q => `🔍 جاري البحث عن: *${q}* ...`,

      best: t => `⭐ أفضل تطابق:\n*${t}*`,

      failed: '❌ فشل تحميل الأغنية.'

    },

    en: {

      usage: 'Usage: .song <song name>',

      searching: q => `🔍 Searching for: *${q}* ...`,

      best: t => `⭐ Best match:\n*${t}*`,

      failed: '❌ Failed to download song.'

    }

  }[lang] || T.en

  try {

    await safeReact(sock, chatId, message.key, '🎵')

    const query = extractQuery(message, args)

    if (!query) {

      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message })

      return

    }

    let searchMsg

    let video

    if (isYouTubeUrl(query)) {

      video = { url: query }

    } else {

      searchMsg = await sock.sendMessage(

        chatId,

        { text: T.searching(query) },

        { quoted: message }

      )

      const search = await yts(query)

      if (!search?.videos?.length) {

        await sock.sendMessage(chatId, { text: T.failed }, { quoted: message })

        return

      }

      video = search.videos[0]

      await sock.sendMessage(chatId, {

        text: T.best(video.title),

        edit: searchMsg.key

      })

    }

    let audioData

    try {

      audioData = await getLolhumanAudioByUrl(video.url)

    } catch {

      try {

        audioData = await getYupraDownloadByUrl(video.url)

      } catch {

        audioData = await getOkatsuDownloadByUrl(video.url)

      }

    }

    const buffer = await downloadToBuffer(audioData.download)

    const ext = detectAudioExt(buffer)

    const finalBuffer = ext === 'mp3' ? buffer : await toAudio(buffer, ext)

    await sock.sendMessage(

      chatId,

      {

        audio: finalBuffer,

        mimetype: 'audio/mpeg',

        fileName: `${safeFileName(audioData.title)}.mp3`

      },

      { quoted: message }

    )

    await safeReact(sock, chatId, message.key, '✅')

  } catch (e) {

    await safeReact(sock, chatId, message.key, '❌')

    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message })

  }

}

module.exports = {

  name: 'song',

  aliases: ['song', 'play', 'music', 'اغنية', 'أغنية', 'شغل'],

  run: songCommand,

  exec: songCommand,

  execute: songCommand

}