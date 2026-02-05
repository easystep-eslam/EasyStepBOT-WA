const axios = require('axios');

const fs = require('fs');

const path = require('path');

const { getLang } = require('../../lib/lang');

const getApi = require('../../lib/api');

// APIs

let autoresApi = null;

let lolhumanApi = null;

try { autoresApi = getApi('autoresbot'); } catch (e) { console.log('[AUTORESBOT INIT FAIL]', e.message); }

try { lolhumanApi = getApi('lolhuman'); } catch (e) { console.log('[LOLHUMAN INIT FAIL]', e.message); }

// ================= HELPERS =================

function pickChatId(maybeChatId, message) {

  if (typeof maybeChatId === 'string' && maybeChatId.includes('@')) return maybeChatId;

  return message?.key?.remoteJid || null;

}

function getText(message) {

  return (

    message?.message?.conversation ||

    message?.message?.extendedTextMessage?.text ||

    message?.message?.imageMessage?.caption ||

    message?.message?.videoMessage?.caption ||

    ''

  ).trim();

}

async function safeReact(sock, chatId, key, emoji) {

  try { await sock.sendMessage(chatId, { react: { text: emoji, key } }); } catch {}

}

async function safeSend(sock, chatId, payload, opts) {

  try { return await sock.sendMessage(chatId, payload, opts); } catch {}

}

function isFbUrl(url) {

  return /facebook\.com|fb\.watch/i.test(url);

}

async function resolveRedirect(url) {

  try {

    const r = await axios.get(url, {

      timeout: 20000,

      maxRedirects: 10,

      headers: { 'User-Agent': 'Mozilla/5.0' }

    });

    return r?.request?.res?.responseUrl || url;

  } catch {

    return url;

  }

}

// ================= API SOURCES =================

async function getFromAutoresbot(url) {

  if (!autoresApi) throw new Error('AUTORESBOT_MISSING');

  const r = await autoresApi.get('/api/downloader/facebook', {

    params: { url },

    timeout: 90000,

    validateStatus: () => true

  });

  if (!r?.data) throw new Error('AUTORESBOT_EMPTY');

  const d = r.data.data || r.data.result || r.data;

  const videoUrl = Array.isArray(d) ? d[0] : d?.url || d?.link || d;

  if (!videoUrl) throw new Error('AUTORESBOT_NO_URL');

  return videoUrl;

}

async function getFromLolhuman(url) {

  if (!lolhumanApi) throw new Error('LOLHUMAN_MISSING');

  const r = await lolhumanApi.get('/api/facebook', {

    params: { url },

    timeout: 90000,

    validateStatus: () => true

  });

  const d = r?.data?.result || r?.data;

  const videoUrl =

    d?.media?.video_hd ||

    d?.media?.video_sd ||

    d?.hd ||

    d?.sd ||

    d?.url;

  if (!videoUrl) throw new Error('LOLHUMAN_NO_URL');

  return videoUrl;

}

async function trySource(fn) {

  try { return await fn(); } catch { return null; }

}

// ================= MAIN COMMAND =================

async function facebookCommand(sock, chatIdArg, message) {

  const chatId = pickChatId(chatIdArg, message);

  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {

    ar: {

      needUrl: 'من فضلك ابعت رابط فيديو فيسبوك.',

      notFb: 'ده مش رابط فيسبوك.',

      cantGet: '❌ فشل تحميل فيديو فيسبوك.',

      downloadedBy: 'تم التحميل بواسطة',

      footer: '> © EasyStep'

    },

    en: {

      needUrl: 'Please send a Facebook video link.',

      notFb: 'This is not a Facebook link.',

      cantGet: '❌ Failed to download Facebook video.',

      downloadedBy: 'Downloaded by',

      footer: '> © EasyStep'

    }

  }[lang] || TXT.en;

  try {

    const text = getText(message);

    const url = text.split(/\s+/).slice(1).join(' ').trim();

    if (!url) {

      await safeSend(sock, chatId, { text: TXT.needUrl }, { quoted: message });

      return;

    }

    if (!isFbUrl(url)) {

      await safeSend(sock, chatId, { text: TXT.notFb }, { quoted: message });

      return;

    }

    await safeReact(sock, chatId, message.key, '📥');

    const resolvedUrl = await resolveRedirect(url);

    const videoUrl =

      (await trySource(() => getFromAutoresbot(resolvedUrl))) ||

      (await trySource(() => getFromAutoresbot(url))) ||

      (await trySource(() => getFromLolhuman(resolvedUrl))) ||

      (await trySource(() => getFromLolhuman(url)));

    if (!videoUrl) {

      await safeSend(sock, chatId, { text: TXT.cantGet }, { quoted: message });

      return;

    }

    const caption =

`${TXT.downloadedBy}

──────────────

${TXT.footer}`;

    // حاول إرسال مباشر

    try {

      await safeSend(

        sock,

        chatId,

        { video: { url: videoUrl }, mimetype: 'video/mp4', caption },

        { quoted: message }

      );

      return;

    } catch {}

    // fallback تحميل مؤقت

    const tmpDir = path.join(process.cwd(), 'tmp');

    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

    const res = await axios({

      method: 'GET',

      url: videoUrl,

      responseType: 'stream',

      timeout: 90000,

      headers: { 'User-Agent': 'Mozilla/5.0' }

    });

    const writer = fs.createWriteStream(tempFile);

    res.data.pipe(writer);

    await new Promise((resolve, reject) => {

      writer.on('finish', resolve);

      writer.on('error', reject);

    });

    await safeSend(

      sock,

      chatId,

      { video: { url: tempFile }, mimetype: 'video/mp4', caption },

      { quoted: message }

    );

    fs.unlinkSync(tempFile);

  } catch (e) {

    console.error('[FB ERROR]', e);

    await safeSend(sock, chatId, { text: TXT.cantGet }, { quoted: message });

  }

}

module.exports = {

  name: 'fb',

  aliases: ['fb', 'facebook', 'فيس', 'فيسبوك'],

  category: {

    ar: '📥 أوامر التحميل',

    en: '📥 Download Commands'

  },

  description: {

    ar: 'تحميل فيديو من فيسبوك.',

    en: 'Download Facebook videos.'

  },

  usage: {

    ar: '.fb <link>',

    en: '.fb <link>'

  },

  emoji: '📥',

  admin: false,

  owner: false,

  showInMenu: true,

  run: facebookCommand,

  exec: (sock, message) => facebookCommand(sock, message?.key?.remoteJid, message),

  execute: (sock, message) => facebookCommand(sock, message?.key?.remoteJid, message)

};