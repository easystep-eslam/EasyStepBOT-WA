const { getLang } = require('../../lib/lang')

const COUNTRY_TZ = [

  { code: 'MY', nameEn: 'Malaysia', nameAr: 'ماليزيا', tz: 'Asia/Kuala_Lumpur', keys: ['malaysia', 'malay', 'ماليزيا'] },

  { code: 'SA', nameEn: 'Saudi Arabia', nameAr: 'السعودية', tz: 'Asia/Riyadh', keys: ['saudi', 'ksa', 'saudi arabia', 'السعودية', 'سعودية', 'المملكة'] },

  { code: 'EG', nameEn: 'Egypt', nameAr: 'مصر', tz: 'Africa/Cairo', keys: ['egypt', 'eg', 'مصر'] },

  { code: 'AE', nameEn: 'United Arab Emirates', nameAr: 'الإمارات', tz: 'Asia/Dubai', keys: ['uae', 'emirates', 'dubai', 'الإمارات', 'امارات'] },

  { code: 'QA', nameEn: 'Qatar', nameAr: 'قطر', tz: 'Asia/Qatar', keys: ['qatar', 'قطر'] },

  { code: 'KW', nameEn: 'Kuwait', nameAr: 'الكويت', tz: 'Asia/Kuwait', keys: ['kuwait', 'الكويت'] },

  { code: 'BH', nameEn: 'Bahrain', nameAr: 'البحرين', tz: 'Asia/Bahrain', keys: ['bahrain', 'البحرين'] },

  { code: 'OM', nameEn: 'Oman', nameAr: 'عُمان', tz: 'Asia/Muscat', keys: ['oman', 'muscat', 'عمان', 'عُمان'] },

  { code: 'JO', nameEn: 'Jordan', nameAr: 'الأردن', tz: 'Asia/Amman', keys: ['jordan', 'amman', 'الأردن', 'الاردن'] },

  { code: 'LB', nameEn: 'Lebanon', nameAr: 'لبنان', tz: 'Asia/Beirut', keys: ['lebanon', 'beirut', 'لبنان'] },

  { code: 'IQ', nameEn: 'Iraq', nameAr: 'العراق', tz: 'Asia/Baghdad', keys: ['iraq', 'baghdad', 'العراق'] },

  { code: 'SY', nameEn: 'Syria', nameAr: 'سوريا', tz: 'Asia/Damascus', keys: ['syria', 'damascus', 'سوريا', 'الشام'] },

  { code: 'PS', nameEn: 'Palestine', nameAr: 'فلسطين', tz: 'Asia/Gaza', keys: ['palestine', 'gaza', 'west bank', 'فلسطين', 'غزة'] },

  { code: 'TR', nameEn: 'Turkey', nameAr: 'تركيا', tz: 'Europe/Istanbul', keys: ['turkey', 'istanbul', 'تركيا'] },

  { code: 'IR', nameEn: 'Iran', nameAr: 'إيران', tz: 'Asia/Tehran', keys: ['iran', 'tehran', 'ايران', 'إيران'] },

  { code: 'GB', nameEn: 'United Kingdom', nameAr: 'بريطانيا', tz: 'Europe/London', keys: ['uk', 'u.k', 'britain', 'england', 'united kingdom', 'london', 'بريطانيا', 'انجلترا', 'إنجلترا'] },

  { code: 'FR', nameEn: 'France', nameAr: 'فرنسا', tz: 'Europe/Paris', keys: ['france', 'paris', 'فرنسا'] },

  { code: 'DE', nameEn: 'Germany', nameAr: 'ألمانيا', tz: 'Europe/Berlin', keys: ['germany', 'berlin', 'ألمانيا', 'المانيا'] },

  { code: 'IT', nameEn: 'Italy', nameAr: 'إيطاليا', tz: 'Europe/Rome', keys: ['italy', 'rome', 'إيطاليا', 'ايطاليا'] },

  { code: 'ES', nameEn: 'Spain', nameAr: 'إسبانيا', tz: 'Europe/Madrid', keys: ['spain', 'madrid', 'إسبانيا', 'اسبانيا'] },

  { code: 'NL', nameEn: 'Netherlands', nameAr: 'هولندا', tz: 'Europe/Amsterdam', keys: ['netherlands', 'holland', 'amsterdam', 'هولندا'] },

  { code: 'US', nameEn: 'United States', nameAr: 'أمريكا', tz: 'America/New_York', keys: ['usa', 'us', 'america', 'united states', 'أمريكا', 'امريكا'] },

  { code: 'CA', nameEn: 'Canada', nameAr: 'كندا', tz: 'America/Toronto', keys: ['canada', 'كندا'] },

  { code: 'BR', nameEn: 'Brazil', nameAr: 'البرازيل', tz: 'America/Sao_Paulo', keys: ['brazil', 'brasil', 'البرازيل'] },

  { code: 'IN', nameEn: 'India', nameAr: 'الهند', tz: 'Asia/Kolkata', keys: ['india', 'ind', 'الهند'] },

  { code: 'PK', nameEn: 'Pakistan', nameAr: 'باكستان', tz: 'Asia/Karachi', keys: ['pakistan', 'باكستان'] },

  { code: 'BD', nameEn: 'Bangladesh', nameAr: 'بنجلاديش', tz: 'Asia/Dhaka', keys: ['bangladesh', 'bd', 'بنجلاديش'] },

  { code: 'CN', nameEn: 'China', nameAr: 'الصين', tz: 'Asia/Shanghai', keys: ['china', 'shanghai', 'الصين'] },

  { code: 'JP', nameEn: 'Japan', nameAr: 'اليابان', tz: 'Asia/Tokyo', keys: ['japan', 'tokyo', 'اليابان'] },

  { code: 'KR', nameEn: 'South Korea', nameAr: 'كوريا الجنوبية', tz: 'Asia/Seoul', keys: ['korea', 'south korea', 'seoul', 'كوريا', 'كوريا الجنوبية'] },

  { code: 'ID', nameEn: 'Indonesia', nameAr: 'إندونيسيا', tz: 'Asia/Jakarta', keys: ['indonesia', 'jakarta', 'اندونيسيا', 'إندونيسيا'] },

  { code: 'SG', nameEn: 'Singapore', nameAr: 'سنغافورة', tz: 'Asia/Singapore', keys: ['singapore', 'سنغافورة'] },

  { code: 'TH', nameEn: 'Thailand', nameAr: 'تايلاند', tz: 'Asia/Bangkok', keys: ['thailand', 'bangkok', 'تايلاند'] },

  { code: 'PH', nameEn: 'Philippines', nameAr: 'الفلبين', tz: 'Asia/Manila', keys: ['philippines', 'manila', 'الفلبين'] },

  { code: 'AU', nameEn: 'Australia', nameAr: 'أستراليا', tz: 'Australia/Sydney', keys: ['australia', 'sydney', 'أستراليا', 'استراليا'] },

  { code: 'NZ', nameEn: 'New Zealand', nameAr: 'نيوزيلندا', tz: 'Pacific/Auckland', keys: ['new zealand', 'nz', 'auckland', 'نيوزيلندا'] },

  { code: 'ZA', nameEn: 'South Africa', nameAr: 'جنوب أفريقيا', tz: 'Africa/Johannesburg', keys: ['south africa', 'johannesburg', 'جنوب افريقيا', 'جنوب أفريقيا'] },

  { code: 'MA', nameEn: 'Morocco', nameAr: 'المغرب', tz: 'Africa/Casablanca', keys: ['morocco', 'casablanca', 'المغرب'] },

  { code: 'DZ', nameEn: 'Algeria', nameAr: 'الجزائر', tz: 'Africa/Algiers', keys: ['algeria', 'algiers', 'الجزائر'] },

  { code: 'TN', nameEn: 'Tunisia', nameAr: 'تونس', tz: 'Africa/Tunis', keys: ['tunisia', 'tunis', 'تونس'] }

]

const FLAGS = {

  MY: '🇲🇾', SA: '🇸🇦', EG: '🇪🇬', AE: '🇦🇪', QA: '🇶🇦', KW: '🇰🇼', BH: '🇧🇭', OM: '🇴🇲', JO: '🇯🇴', LB: '🇱🇧', IQ: '🇮🇶', SY: '🇸🇾', PS: '🇵🇸', TR: '🇹🇷', IR: '🇮🇷',

  GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸', NL: '🇳🇱',

  US: '🇺🇸', CA: '🇨🇦', BR: '🇧🇷',

  IN: '🇮🇳', PK: '🇵🇰', BD: '🇧🇩',

  CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷',

  ID: '🇮🇩', SG: '🇸🇬', TH: '🇹🇭', PH: '🇵🇭',

  AU: '🇦🇺', NZ: '🇳🇿',

  ZA: '🇿🇦', MA: '🇲🇦', DZ: '🇩🇿', TN: '🇹🇳'

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

function extractQuery(message, args = []) {

  let q = Array.isArray(args) && args.length ? args.join(' ').trim() : ''

  if (q) return q

  const raw = getRawText(message)

  const used = (raw.split(/\s+/)[0] || '.time').trim()

  return raw.slice(used.length).trim()

}

function normalize(s) {

  return String(s || '')

    .toLowerCase()

    .replace(/[_-]/g, ' ')

    .replace(/[^\p{L}\p{N}\s]/gu, '')

    .trim()

}

function scoreMatch(needle, hay) {

  if (!needle || !hay) return 0

  if (hay === needle) return 100

  if (hay.startsWith(needle)) return 80

  if (hay.includes(needle)) return 60

  const n = needle.split(/\s+/)

  let hit = 0

  for (const w of n) if (hay.includes(w)) hit++

  return Math.round((hit / Math.max(1, n.length)) * 50)

}

function findMatches(q) {

  const query = normalize(q)

  if (!query) return { best: null, list: [] }

  const scored = []

  for (const c of COUNTRY_TZ) {

    const pool = [

      c.nameEn,

      c.nameAr,

      ...(Array.isArray(c.keys) ? c.keys : [])

    ].map(normalize)

    let bestScore = 0

    for (const h of pool) bestScore = Math.max(bestScore, scoreMatch(query, h))

    if (bestScore > 0) scored.push({ c, s: bestScore })

  }

  scored.sort((a, b) => b.s - a.s)

  return { best: scored[0]?.c || null, list: scored.slice(0, 5).map((x) => x.c) }

}

function formatTime12(tz, lang) {

  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {

    hour: 'numeric',

    minute: '2-digit',

    hour12: true,

    timeZone: tz

  }).format(new Date())

}

async function timeCommand(sock, message, args = []) {

  const chatId = message?.key?.remoteJid

  if (!chatId) return

  const lang = getLang(chatId)

  const TXT = {

    en: {

      usage: 'Usage: .time <country>\nExample: .time malaysia',

      title: '🕒 Current Time',

      suggestTitle: '❓ Which country do you mean?',

      suggestLine: (i, flag, name) => `${i}️⃣ ${flag} ${name}`

    },

    ar: {

      usage: 'الاستخدام: .time <الدولة>\nمثال: .time malaysia / .time ماليزيا',

      title: '🕒 الوقت الآن',

      suggestTitle: '❓ تقصد أنهي دولة؟',

      suggestLine: (i, flag, name) => `${i}️⃣ ${flag} ${name}`

    }

  }

  const T = TXT[lang] || TXT.en

  const q = extractQuery(message, args)

  if (!q) {

    await sock.sendMessage(chatId, { text: T.usage }, { quoted: message })

    return

  }

  const { best, list } = findMatches(q)

  if (!best || !best.tz) {

    const lines = (list || []).slice(0, 5).map((c, idx) => {

      const flag = FLAGS[c.code] || '🏳️'

      const name = lang === 'ar' ? c.nameAr : c.nameEn

      return T.suggestLine(idx + 1, flag, name)

    })

    const text = lines.length

      ? `${T.suggestTitle}\n\n${lines.join('\n')}`

      : T.usage

    await sock.sendMessage(chatId, { text }, { quoted: message })

    return

  }

  const flag = FLAGS[best.code] || '🏳️'

  const name = lang === 'ar' ? best.nameAr : best.nameEn

  const time = formatTime12(best.tz, lang)

  const out =

    `${T.title}\n` +

    `${flag} ${name}\n\n` +

    `⏰ ${time}`

  await sock.sendMessage(chatId, { text: out }, { quoted: message })

}

module.exports = {

  name: 'time',

  aliases: ['time', 'clock', 'وقت', 'الوقت'],

  category: {

    ar: '🤖 أدوات EasyStep',

    en: '🤖 Easystep Tools'

  },

  description: {

    ar: 'يعرض الوقت الحالي لدولة (توقيت افتراضي للعاصمة).',

    en: 'Show current time for a country (default capital timezone).'

  },

  usage: {

    ar: '.time <الدولة>',

    en: '.time <country>'

  },

  emoji: '🕒',

  admin: false,

  owner: false,

  showInMenu: true,

  run: timeCommand,

  exec: timeCommand,

  execute: timeCommand

}