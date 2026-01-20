const fs = require('fs')

const path = require('path')

const STATE_FILE = path.join(__dirname, '../data/send/state.json')

function ensureState() {

  if (!fs.existsSync(STATE_FILE)) {

    fs.writeFileSync(STATE_FILE, JSON.stringify({

      sentToday: 0,

      stopped: false,

      lastError: null,

      date: new Date().toDateString()

    }, null, 2))

  }

}

function loadState() {

  ensureState()

  const data = JSON.parse(fs.readFileSync(STATE_FILE))

  const today = new Date().toDateString()

  if (data.date !== today) {

    data.sentToday = 0

    data.date = today

    data.stopped = false

    saveState(data)

  }

  return data

}

function saveState(data) {

  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2))

}

function smartDelay(base) {

  const min = base * 1000

  const max = min + 4000

  return Math.floor(Math.random() * (max - min)) + min

}

async function safeSend({ sock, jid, text, settings }) {

  const state = loadState()

  if (state.stopped) return { ok: false, reason: 'stopped' }

  if (state.sentToday >= settings.dailyLimit) {

    state.stopped = true

    saveState(state)

    return { ok: false, reason: 'limit' }

  }

  try {

    await sock.sendMessage(jid, { text })

    state.sentToday++

    saveState(state)

    await new Promise(r => setTimeout(r, smartDelay(settings.delay)))

    return { ok: true }

  } catch (err) {

    state.lastError = err.message

    if (

      err.message?.includes('blocked') ||

      err.message?.includes('rate') ||

      err.message?.includes('spam')

    ) {

      state.stopped = true

    }

    saveState(state)

    return { ok: false, reason: 'error' }

  }

}

module.exports = {

  safeSend

}