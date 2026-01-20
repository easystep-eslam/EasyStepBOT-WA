/**
 * Easystep Bot - A WhatsApp Bot
 * Copyright (c) 2026 Eslam 
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by Eslam 
 * - Pair Code implementation inspired by TechGod3 & DGXON
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1) // Panel will auto-restart
    }
}, 30_000) // check every 30 seconds

let phoneNumber = "201065537938"
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "Easystep BOT"
global.themeemoji = "•"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

async function startXeonBotInc() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        // Save credentials when they update
        XeonBotInc.ev.on('creds.update', saveCreds)

        store.bind(XeonBotInc.ev)

        // Group participants (WELCOME & GOODBYE)
        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update)
        })

        // Message handling
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate);
                    return;
                }
                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                try {
                    await handleMessages(XeonBotInc, chatUpdate, true)
                } catch (err) {
                    console.error("Error in handleMessages:", err)
                    if (mek.key && mek.key.remoteJid) {
                        await XeonBotInc.sendMessage(mek.key.remoteJid, {
                            text: `😂 استنى بس… شكلي لخبط شوية!
جرّب الأمر تاني ولو منفعش يبقى العيب مش منك 😎`
                        }).catch(console.error);
                    }
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err)
            }
        })

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            } else return jid
        }

        XeonBotInc.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = XeonBotInc.decodeJid(contact.id)
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
            }
        })

        XeonBotInc.getName = (jid, withoutContact = false) => {
            id = XeonBotInc.decodeJid(jid)
            withoutContact = XeonBotInc.withoutContact || withoutContact
            let v
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
            else v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
                id === XeonBotInc.decodeJid(XeonBotInc.user.id) ? XeonBotInc.user : (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')

            let phoneNumber
            if (!!global.phoneNumber) phoneNumber = global.phoneNumber
            else phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍
Numberbot : `)))

            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
            const pn = require('awesome-phonenumber');
            if (!pn('+' + phoneNumber).isValid()) {
                console.log(chalk.red('Invalid phone number. Please enter your full international number without + or spaces.'));
                process.exit(1);
            }

            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(phoneNumber)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                } catch (error) {
                    console.error('Error requesting pairing code:', error)
                }
            }, 3000)
        }

        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s
            if (qr) console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
            if (connection === 'connecting') console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))

           if (connection === "open") {
    console.log(
        chalk.yellow(
            '🌿 Connected to => ' +
            JSON.stringify(XeonBotInc.user, null, 2)
        )
    );

    try {
        const fs = require('fs');
        const path = require('path');

        // ===============================
        // Prepare bot data
        // ===============================
        const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        const botLid = XeonBotInc.user.lid || '';
        const botName = XeonBotInc.user.name || '';

        global.botJid = botJid;

        // ===============================
        // Save to bot.json
        // ===============================
        const botDataPath = path.join(__dirname, 'data', 'bot.json');

        const botData = {
            jid: botJid,
            lid: botLid,
            name: botName
        };

        fs.writeFileSync(botDataPath, JSON.stringify(botData, null, 2));

        console.log('[BOT] JID saved:', global.botJid);

        // ===============================
        // Startup log (unchanged)
        // ===============================
        console.log('[Easystep BOT] Started successfully at', new Date().toLocaleString());

        // ===============================
        // Expose socket for AUTO AZAN ONLY
        // ===============================
        global.sock = XeonBotInc;

        // 🚫 ممنوع الإرسال هنا – كان سبب الكراش
        // await XeonBotInc.sendMessage(
        //     'status@broadcast',
        //     { text: 'Bot started' }
        // );

    } catch (e) {
        console.log('[BOT] Init error:', e);
    }
}

            

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldReconnect) {
                    await delay(5000)
                    startXeonBotInc()
                }
            }
        })

        return XeonBotInc
    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        await delay(5000)
        startXeonBotInc()
    }
}

startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err))
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err))

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})


// ===============================
// 🕌 AUTO AZAN MODULE (MuslimSalat - Cairo)
// ===============================




async function checkAutoAzan(sock) {
    try {
        const now = new Date();
        const timeNow = now.toLocaleTimeString('en-EG', {
            hour12: false,
            timeZone: 'Africa/Cairo'
        }).slice(0, 5);

        const today = now.toISOString().split('T')[0];

        const res = await axios.get(
            "https://muslimsalat.com/cairo.json",
            { timeout: 10000 }
        );

        const d = res.data.items[0];

        const timings = {
            Fajr: d.fajr,
            Dhuhr: d.dhuhr,
            Asr: d.asr,
            Maghrib: d.maghrib,
            Isha: d.isha
        };

        for (const prayer in timings) {
            if (timings[prayer] === timeNow) {
                if (lastAzanSent[prayer] === today) return;

                lastAzanSent[prayer] = today;
                console.log(`[AZAN] ${prayer} at ${timeNow}`);

                for (const jid of Object.keys(sock.chats || {})) {
                    if (!jid.endsWith('@g.us')) continue;

                    await sock.sendMessage(jid, {
                        audio: { url: AZAN_AUDIO },
                        mimetype: 'audio/mp4',
                        ptt: false
                    }).catch(()=>{});

                    await sock.sendMessage(jid, {
                        text: `🕌 *حان الآن وقت ${prayer}*
⏰ بتوقيت القاهرة
🤲 اللهم تقبل منا ومنكم`
                    }).catch(()=>{});
                }
            }
        }

    } catch (e) {
        console.error("AUTO AZAN ERROR:", e.message);
    }
}

// فحص كل دقيقة
setInterval(() => {
    if (global.sock) checkAutoAzan(global.sock);
}, 60 * 1000);

// ===============================
// END AUTO AZAN MODULE
// ===============================
