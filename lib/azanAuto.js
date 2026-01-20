const axios = require("axios");

const fs = require("fs");

const path = require("path");

const { getLang } = require("../lib/lang");

// ==========================

// Local AZAN Audio

// ==========================

const AZAN_AUDIO = path.join(__dirname, "../assets/WA0059.m4a");

// ==========================

// Paths

// ==========================

const DATA_DIR = path.join(__dirname, "../data");

const AZAN_GROUPS = path.join(DATA_DIR, "azanAuto.json");

const AZAN_TIME = path.join(DATA_DIR, "azanTime.json");

// ==========================

// Ensure folders & files

// ==========================

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(AZAN_GROUPS)) {

  fs.writeFileSync(AZAN_GROUPS, JSON.stringify({ groups: {} }, null, 2));

}

if (!fs.existsSync(AZAN_TIME)) {

  fs.writeFileSync(AZAN_TIME, JSON.stringify({}, null, 2));

}

// ==========================

// Helpers

// ==========================

const loadJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

const saveJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

// ==========================

// Names

// ==========================

const PRAYER = {

  Fajr: { ar: "الفجر", en: "Fajr" },

  Dhuhr: { ar: "الظهر", en: "Dhuhr" },

  Asr: { ar: "العصر", en: "Asr" },

  Maghrib: { ar: "المغرب", en: "Maghrib" },

  Isha: { ar: "العشاء", en: "Isha" }

};

const CITY = {

  cairo: { ar: "القاهرة", en: "Cairo" },

  alexandria: { ar: "الإسكندرية", en: "Alexandria" },

  giza: { ar: "الجيزة", en: "Giza" },

  mecca: { ar: "مكة المكرمة", en: "Makkah" },

  medina: { ar: "المدينة المنورة", en: "Madinah" }

};

// ==========================

// Time helpers

// ==========================

function to24(time) {

  if (!time) return null;

  const parts = time.toLowerCase().trim().split(" ");

  const t = parts[0];

  const m = parts[1];

  let [h, min] = t.split(":").map(Number);

  if (m === "pm" && h !== 12) h += 12;

  if (m === "am" && h === 12) h = 0;

  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;

}

function toMin(t) {

  const [h, m] = String(t || "").split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  return h * 60 + m;

}

// ==========================

// Fetch prayer times

// ==========================

async function fetchPrayerTimes(city) {

  const all = loadJSON(AZAN_TIME);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

  if (all[city] && all[city].date === today) {

    return all[city].timings;

  }

  const res = await axios.get(`https://muslimsalat.com/${city}.json`, { timeout: 10000 });

  const d = res.data.items[0];

  const timings = {

    Fajr: to24(d.fajr),

    Dhuhr: to24(d.dhuhr),

    Asr: to24(d.asr),

    Maghrib: to24(d.maghrib),

    Isha: to24(d.isha)

  };

  all[city] = { date: today, timings };

  saveJSON(AZAN_TIME, all);

  return timings;

}

// ==========================

// Message builder

// ==========================

function buildAzanMessage({ lang, prayerKey, cityKey, time24 }) {

  const prayerName = PRAYER[prayerKey]?.[lang] || PRAYER[prayerKey]?.en;

  const cityName = CITY[cityKey]?.[lang] || CITY[cityKey]?.en;

  return lang === "ar"

    ? `🕌 *حان الآن موعد أذان ${prayerName}*\n\n📍 حسب توقيت ${cityName}\n⏰ ${time24}\n\n﴿ إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا ﴾`

    : `🕌 *It is time for ${prayerName} Adhan*\n\n📍 Local time in ${cityName}\n⏰ ${time24}`;

}

// ==========================

// Auto Azan Engine (FIXED)

// ==========================

const sentToday = {};

let started = false;

async function tick(sock) {

  const nowTime = new Date().toLocaleTimeString("en-GB", {

    timeZone: "Africa/Cairo",

    hour: "2-digit",

    minute: "2-digit"

  });

  const today = new Date().toLocaleDateString("en-CA", {

    timeZone: "Africa/Cairo"

  });

  const nowMin = toMin(nowTime);

  if (nowMin == null) return;

  const data = loadJSON(AZAN_GROUPS);

  const groups = data.groups || {};

  for (const [jid, city] of Object.entries(groups)) {

    const cityKey = (city || "cairo").toLowerCase();

    const timings = await fetchPrayerTimes(cityKey);

    for (const [prayerKey, time24] of Object.entries(timings)) {

      const targetMin = toMin(time24);

      if (targetMin == null) continue;

      const key = `${today}-${jid}-${prayerKey}`;

      if (sentToday[key]) continue;

      const diff = nowMin - targetMin;

      // ✅ سماحية 1 دقائق

      if (diff < 0 || diff > 1) continue;

      sentToday[key] = true;

      const lang = getLang(jid) || "en";

      const msg = buildAzanMessage({ lang, prayerKey, cityKey, time24 });

      await sock.sendMessage(jid, { text: msg }).catch(() => {});

      await sock.sendMessage(jid, {

        audio: fs.readFileSync(AZAN_AUDIO),

        mimetype: "audio/mp4"

      }).catch(() => {});

    }

  }

}

function startAutoAzan(sock) {

  if (started) return;

  started = true;

  const now = new Date();

  const msToNextMinute =

    (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {

    tick(sock);

    setInterval(() => tick(sock), 60000);

  }, Math.max(0, msToNextMinute));

}

// ==========================

// Enable / Disable

// ==========================

async function enable(chatId, city = "cairo") {

  const data = loadJSON(AZAN_GROUPS);

  data.groups[chatId] = city.toLowerCase();

  saveJSON(AZAN_GROUPS, data);

  await fetchPrayerTimes(city.toLowerCase());

}

function disable(chatId) {

  const data = loadJSON(AZAN_GROUPS);

  delete data.groups[chatId];

  saveJSON(AZAN_GROUPS, data);

}

module.exports = {

  startAutoAzan,

  enable,

  disable

};