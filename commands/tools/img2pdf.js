const fs = require('fs')

const path = require('path')

const PDFDocument = require('pdfkit')

const { getLang } = require('../../lib/lang')

const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

async function safeReact(sock, chatId, key, emoji) {

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } })

  } catch {}

}

function getImageMessage(message) {

  const m = message?.message || {}

  return (

    m.imageMessage ||

    m.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||

    null

  )

}

async function downloadImageBuffer(imageMsg) {

  const stream = await downloadContentFromMessage(imageMsg, 'image')

  const chunks = []

  for await (const chunk of stream) chunks.push(chunk)

  return Buffer.concat(chunks)

}

function safeFileName(name) {

  return String(name || 'image')

    .replace(/[\\/:*?"<>|]/g, '')

    .replace(/\s+/g, ' ')

    .trim()

    .slice(0, 80)

}

async function img2pdfCommand(sock, message) {

  const chatId = message.key.remoteJid

  const lang = getLang(chatId)

  const TXT = {

    en: {

      needImage: '❌ Please send an image or reply to an image.',

      converting: '⏳ Converting image to PDF...',

      failed: '❌ Failed to convert image.',

      done: '✅ Image converted to PDF.'

    },

    ar: {

      needImage: '❌ لازم تبعت صورة أو ترد على صورة.',

      converting: '⏳ جاري تحويل الصورة إلى PDF...',

      failed: '❌ فشل تحويل الصورة.',

      done: '✅ تم تحويل الصورة إلى PDF.'

    }

  }

  const T = TXT[lang] || TXT.en

  // تجهيز tmp

  const tmpDir = path.join(__dirname, '../../tmp')

  fs.mkdirSync(tmpDir, { recursive: true })

  let imgPath, pdfPath

  try {

    await safeReact(sock, chatId, message.key, '🧾')

    const imageMsg = getImageMessage(message)

    if (!imageMsg) {

      await sock.sendMessage(chatId, { text: T.needImage }, { quoted: message })

      await safeReact(sock, chatId, message.key, '❌')

      return

    }

    await sock.sendMessage(chatId, { text: T.converting }, { quoted: message })

    const buffer = await downloadImageBuffer(imageMsg)

    if (!buffer?.length) throw new Error('Empty image')

    // امتداد حسب الميم تايب (أفضل من فرض jpg)

    const mime = imageMsg.mimetype || 'image/jpeg'

    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'

    const fileBase = safeFileName('image_to_pdf')

    imgPath = path.join(tmpDir, `${Date.now()}_${fileBase}.${ext}`)

    pdfPath = path.join(tmpDir, `${Date.now()}_${fileBase}.pdf`)

    fs.writeFileSync(imgPath, buffer)

    // إنشاء PDF

    const doc = new PDFDocument({ autoFirstPage: false })

    const stream = fs.createWriteStream(pdfPath)

    doc.pipe(stream)

    const img = doc.openImage(imgPath)

    doc.addPage({ size: [img.width, img.height] })

    doc.image(img, 0, 0)

    doc.end()

    await new Promise((res, rej) => {

      stream.on('finish', res)

      stream.on('error', rej)

    })

    await sock.sendMessage(

      chatId,

      {

        document: fs.readFileSync(pdfPath),

        mimetype: 'application/pdf',

        fileName: `${fileBase}.pdf`,

        caption: T.done

      },

      { quoted: message }

    )

    await safeReact(sock, chatId, message.key, '✅')

  } catch (err) {

    console.error('[IMG2PDF]', err)

    await safeReact(sock, chatId, message.key, '❌')

    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message })

  } finally {

    // تنظيف الملفات حتى لو حصل خطأ

    try { if (imgPath && fs.existsSync(imgPath)) fs.unlinkSync(imgPath) } catch {}

    try { if (pdfPath && fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath) } catch {}

  }

}

module.exports = {

  name: 'img2pdf',

  aliases: ['img2pdf', 'pdf', 'topdf', 'صورة_لـpdf'],

  category: {

    ar: '🤖 أدوات EasyStep',

    en: '🤖 Easystep Tools'

  },

  description: {

    ar: 'تحويل صورة إلى ملف PDF.',

    en: 'Convert an image to a PDF file.'

  },

  usage: {

    ar: '.img2pdf (مع صورة أو رد على صورة)',

    en: '.img2pdf (send or reply to image)'

  },

  emoji: '🧾',

  admin: true,

  owner: false,

  showInMenu: true,

  run: img2pdfCommand,

  exec: img2pdfCommand,

  execute: img2pdfCommand

}