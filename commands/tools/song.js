const axios = require('axios')

const yts = require('yt-search')

const { toAudio } = require('../../lib/converter')

const { getLang } = require('../../lib/lang')

const getApi = require('../../lib/api')

const api = getApi() // lolhuman axios instance

async function safeReact(sock, chatId, key, emoji) {

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } })

  } catch {}

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

/* ===================== LOLHUMAN ===================== */

async function getLolhumanAudio(url) {

  console.log('[SONG] Trying lolhuman...')

  const res = await api.get('/api/ytaudio', {

    params: { url }

  })

  console.log('[LOLHUMAN RESPONSE]', res.data)

  const link = res?.data?.result?.link

  if (!link) throw new Error('LOLHUMAN_NO_LINK')

  return {

    download: link,

    title: res.data.result.title,

    thumb: res.data.result.thumbnail

  }

}

/* ===================== FALLBACK 1 ===================== */

async function getYupra(url) {

  console.log('[SONG] Trying yupra...')

  const r = await axios.get(

    `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,

    { timeout: 60000 }

  )

  if (!r?.data?.success) throw new Error('YUPRA_FAILED')

  return {

    download: r.data.data.download_url,

    title: r.data.data.title,

    thumb: r.data.data.thumbnail

  }

}

/* ===================== FALLBACK 2 ===================== */

async function getOkatsu(url) {

  console.log('[SONG] Trying okatsu...')

  const r = await axios.get(

    `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,

    { timeout: 60000 }

  )

  if (!r?.data?.dl) throw new Error('OKATSU_FAILED')

  return {

    download: r.data.dl,

    title: r.data.title,

    thumb: r.data.thumb

  }

}

/* ===================== MAIN COMMAND ===================== */

async function songCommand(sock, message, args = []) {

  const chatId = message.key.remoteJid

  const lang = getLang(chatId)

  const T = {

    ar: {

      usage: 'اكتب: .song <اسم الأغنية>',

      searching: q => `🔍 جاري البحث عن: *${q}*`,

      best: t => `⭐ أفضل نتيجة:\n*${t}*`,

      failed: '❌ فشل تحميل الأغنية.'

    },

    en: {

      usage: 'Usage: .song <song name>',

      searching: q => `🔍 Searching for: *${q}*`,

      best: t => `⭐ Best match:\n*${t}*`,

      failed: '❌ Failed to download song.'

    }

  }[lang]

  try {

    await safeReact(sock, chatId, message.key, '🎵')

    const query = extractQuery(message, args)

    if (!query) {

      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message })

      return

    }

    let video

    if (isYouTubeUrl(query)) {

      video = { url: query }

    } else {

      const searchingMsg = await sock.sendMessage(

        chatId,

        { text: T.searching(query) },

        { quoted: message }

      )

      const search = await yts(query)

      if (!search?.videos?.length) throw new Error('NO_RESULTS')

      video = search.videos[0]

      await sock.sendMessage(chatId, {

        text: T.best(video.title),

        edit: searchingMsg.key

      })

    }

    let audioData

    try {

      audioData = await getLolhumanAudio(video.url)

    } catch (e1) {

      console.error('[LOLHUMAN ERROR]', e1.message)

      try {

        audioData = await getYupra(video.url)

      } catch (e2) {

        console.error('[YUPRA ERROR]', e2.message)

        audioData = await getOkatsu(video.url)

      }

    }

    console.log('[SONG] Downloading audio...')

    const audioRes = await axios.get(audioData.download, {

      responseType: 'arraybuffer',

      timeout: 90000

    })

    const finalBuffer = await toAudio(Buffer.from(audioRes.data), 'mp3')

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

  } catch (err) {

    console.error('[SONG FATAL ERROR]', err)

    await safeReact(sock, chatId, message.key, '❌')

    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message })

  }

}

module.exports = {

  name: 'song',

  aliases: ['song', 'play', 'music', 'اغنية', 'أغنية'],

  run: songCommand,

  exec: songCommand,

  execute: songCommand

}