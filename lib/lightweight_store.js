const fs = require('fs')

const STORE_FILE = './baileys_store.json'

// Config: keep last 20 messages per chat (configurable)

let MAX_MESSAGES = 20

try {

    const settings = require('../settings.js')

    if (settings.maxStoreMessages && typeof settings.maxStoreMessages === 'number') {

        MAX_MESSAGES = settings.maxStoreMessages

    }

} catch (e) {}

const store = {

    messages: {},

    contacts: {},

    chats: {},

    readFromFile(filePath = STORE_FILE) {

        try {

            if (fs.existsSync(filePath)) {

                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

                this.contacts = data.contacts || {}

                this.chats = data.chats || {}

                this.messages = data.messages || {}

                this.cleanupData()

            }

        } catch (e) {

            console.warn('Failed to read store file:', e.message)

        }

    },

    writeToFile(filePath = STORE_FILE) {

        try {

            const data = JSON.stringify({

                contacts: this.contacts,

                chats: this.chats,

                messages: this.messages

            })

            fs.writeFileSync(filePath, data)

        } catch (e) {

            console.warn('Failed to write store file:', e.message)

        }

    },

    cleanupData() {

        if (this.messages) {

            Object.keys(this.messages).forEach(jid => {

                if (typeof this.messages[jid] === 'object' && !Array.isArray(this.messages[jid])) {

                    const messages = Object.values(this.messages[jid])

                    this.messages[jid] = messages.slice(-MAX_MESSAGES)

                }

            })

        }

    },

    bind(ev) {

        ev.on('messages.upsert', ({ messages }) => {

            messages.forEach(msg => {

                if (!msg.key?.remoteJid) return

                const jid = msg.key.remoteJid

                this.messages[jid] = this.messages[jid] || []

                this.messages[jid].push(msg)

                if (this.messages[jid].length > MAX_MESSAGES) {

                    this.messages[jid] = this.messages[jid].slice(-MAX_MESSAGES)

                }

            })

        })

        // 🔥 التعديل المهم هنا

        ev.on('contacts.update', (contacts) => {

            contacts.forEach(contact => {

                const id = String(contact.id || '')

                if (!id) return

                const name =

                    contact.notify ||

                    contact.name ||

                    contact.verifiedName ||

                    ''

                // محاولة استخراج رقم حقيقي إن وُجد

                const phoneJid =

                    String(contact.phoneNumber || contact.jid || '').trim()

                const phone =

                    phoneJid.includes('@')

                        ? phoneJid.split('@')[0].replace(/\D/g, '')

                        : ''

                // تخزين أساسي

                this.contacts[id] = {

                    id,

                    name,

                    phone,

                    phoneJid: phone ? `${phone}@s.whatsapp.net` : ''

                }

                // ✅ لو ده LID ومعانا رقم حقيقي → اعمل mapping عكسي

                if (id.endsWith('@lid') && phone) {

                    const realJid = `${phone}@s.whatsapp.net`

                    this.contacts[realJid] = this.contacts[realJid] || { id: realJid }

                    this.contacts[realJid].name = this.contacts[realJid].name || name

                    this.contacts[realJid].phone = phone

                    this.contacts[realJid].phoneJid = realJid

                    this.contacts[realJid].lid = id

                }

            })

        })

        ev.on('chats.set', (chats) => {

            this.chats = {}

            chats.forEach(chat => {

                this.chats[chat.id] = { id: chat.id, subject: chat.subject || '' }

            })

        })

    },

    async loadMessage(jid, id) {

        return this.messages[jid]?.find(m => m.key.id === id) || null

    },

    getStats() {

        let totalMessages = 0

        let totalContacts = Object.keys(this.contacts).length

        let totalChats = Object.keys(this.chats).length

        Object.values(this.messages).forEach(chatMessages => {

            if (Array.isArray(chatMessages)) {

                totalMessages += chatMessages.length

            }

        })

        return {

            messages: totalMessages,

            contacts: totalContacts,

            chats: totalChats,

            maxMessagesPerChat: MAX_MESSAGES

        }

    }

}

module.exports = store