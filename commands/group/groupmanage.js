const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getLang } = require('../../lib/lang');
const isAdmin = require('../../lib/isAdmin');

async function ensureGroupAndAdmin(sock, chatId, senderId, message) {
    const lang = getLang(chatId);

    const T = {
        groupOnly: {
            en: 'This command can only be used in groups.',
            ar: 'الأمر ده شغال في الجروبات بس.'
        },
        botAdmin: {
            en: 'Please make the bot an admin first.',
            ar: 'لازم تخلي البوت أدمن الأول.'
        },
        senderAdmin: {
            en: 'Only group admins can use this command.',
            ar: 'الأمر ده للأدمنز بس.'
        }
    };

    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: T.groupOnly[lang] || T.groupOnly.en }, { quoted: message });
        return { ok: false };
    }

    const adminStatus = await isAdmin(sock, chatId, senderId);

    if (!adminStatus.isBotAdmin) {
        await sock.sendMessage(chatId, { text: T.botAdmin[lang] || T.botAdmin.en }, { quoted: message });
        return { ok: false };
    }

    if (!adminStatus.isSenderAdmin) {
        await sock.sendMessage(chatId, { text: T.senderAdmin[lang] || T.senderAdmin.en }, { quoted: message });
        return { ok: false };
    }

    return { ok: true, lang };
}

async function setGroupDescription(sock, chatId, senderId, text, message) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;

    const lang = check.lang;
    const desc = (text || '').trim();

    if (!desc) {
        await sock.sendMessage(chatId, {
            text: lang === 'ar' ? 'الاستخدام: .setgdesc <الوصف>' : 'Usage: .setgdesc <description>'
        }, { quoted: message });
        return;
    }

    await sock.groupUpdateDescription(chatId, desc);
    await sock.sendMessage(chatId, {
        text: lang === 'ar' ? '✅ تم تحديث وصف الجروب.' : '✅ Group description updated.'
    }, { quoted: message });
}

async function setGroupName(sock, chatId, senderId, text, message) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;

    const lang = check.lang;
    const name = (text || '').trim();

    if (!name) {
        await sock.sendMessage(chatId, {
            text: lang === 'ar' ? 'الاستخدام: .setgname <الاسم>' : 'Usage: .setgname <name>'
        }, { quoted: message });
        return;
    }

    await sock.groupUpdateSubject(chatId, name);
    await sock.sendMessage(chatId, {
        text: lang === 'ar' ? '✅ تم تحديث اسم الجروب.' : '✅ Group name updated.'
    }, { quoted: message });
}

async function setGroupPhoto(sock, chatId, senderId, message) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message);
    if (!check.ok) return;

    const lang = check.lang;
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || quoted?.stickerMessage;

    if (!imageMsg) {
        await sock.sendMessage(chatId, {
            text: lang === 'ar'
                ? 'رد على صورة أو ستيكر واكتب الأمر'
                : 'Reply to an image or sticker'
        }, { quoted: message });
        return;
    }

    const stream = await downloadContentFromMessage(
        imageMsg,
        imageMsg.mimetype?.includes('sticker') ? 'sticker' : 'image'
    );

    let buffer = Buffer.from([]);
    for await (const c of stream) buffer = Buffer.concat([buffer, c]);

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const imgPath = path.join(tmpDir, `gpp_${Date.now()}.jpg`);
    fs.writeFileSync(imgPath, buffer);

    await sock.updateProfilePicture(chatId, { url: imgPath });
    fs.unlinkSync(imgPath);

    await sock.sendMessage(chatId, {
        text: lang === 'ar' ? '✅ تم تحديث صورة الجروب.' : '✅ Group photo updated.'
    }, { quoted: message });
}

module.exports = {
    ensureGroupAndAdmin,
    setGroupDescription,
    setGroupName,
    setGroupPhoto
};