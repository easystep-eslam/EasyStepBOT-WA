const handleMessage = require('./handler');

module.exports = function bindEvents(sock) {

    sock.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0];

        if (!msg.message) return;

        if (msg.key && msg.key.remoteJid === 'status@broadcast') return;

        try {

            await handleMessage(sock, msg);

        } catch (e) {

            console.error('Handler error:', e);

        }

    });

};