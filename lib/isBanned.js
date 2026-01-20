const fs = require('fs');

const path = require('path');

const bannedPath = path.join(__dirname, '../data/banned.json');

function isBanned(userId) {

    try {

        if (!fs.existsSync(bannedPath)) return false;

        const bannedUsers = JSON.parse(fs.readFileSync(bannedPath, 'utf8'));

        const cleanId = userId

            .replace(/:\d+/g, '')

            .replace('@s.whatsapp.net', '')

            .replace('@g.us', '');

        return bannedUsers.includes(cleanId);

    } catch {

        return false;

    }

}

module.exports = { isBanned };