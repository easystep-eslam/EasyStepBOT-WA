const { exec } = require('child_process')

let lastCheckAt = 0
let cached = false

function sh(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve('')
      resolve(String(stdout || '').trim())
    })
  })
}

async function hasUpdate() {
  const now = Date.now()
  if (now - lastCheckAt < 5 * 60 * 1000) return cached
  lastCheckAt = now

  const ok = await sh('git rev-parse --is-inside-work-tree')
  if (!ok) {
    cached = false
    return cached
  }

  await sh('git fetch origin main')

  const local = await sh('git rev-parse HEAD')
  const remote = await sh('git rev-parse origin/main')

  cached = Boolean(local && remote && local !== remote)
  return cached
}

module.exports = { hasUpdate }
