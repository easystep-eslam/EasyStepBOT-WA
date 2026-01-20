// lib/isAdmin.js
function cleanId(id = '') {
  // "201234567890:4@lid" -> "201234567890"
  // "201234567890@s.whatsapp.net" -> "201234567890"
  return id.split('@')[0].split(':')[0];
}

function isAdminValue(v) {
  return v === 'admin' || v === 'superadmin';
}

async function isAdmin(sock, chatId, senderId) {
  try {
    // ✅ حماية لو مش جروب
    if (!chatId || !chatId.endsWith('@g.us')) {
      return { isSenderAdmin: false, isBotAdmin: false };
    }

    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants || [];

    const botId = sock.user?.id || '';
    const botLid = sock.user?.lid || '';

    const botIdClean = cleanId(botId);
    const botLidClean = cleanId(botLid);

    const senderIdClean = cleanId(senderId);

    const isBotAdmin = participants.some((p) => {
      const pIdClean = cleanId(p.id || '');
      const pLidClean = cleanId(p.lid || '');
      const pPhoneClean = cleanId(p.phoneNumber || '');

      const botMatches =
        botId === (p.id || '') ||
        botId === (p.lid || '') ||
        botLid === (p.lid || '') ||
        botIdClean === pIdClean ||
        botIdClean === pLidClean ||
        botIdClean === pPhoneClean ||
        botLidClean === pIdClean ||
        botLidClean === pLidClean ||
        botLidClean === pPhoneClean;

      return botMatches && isAdminValue(p.admin);
    });

    const isSenderAdmin = participants.some((p) => {
      const pIdClean = cleanId(p.id || '');
      const pLidClean = cleanId(p.lid || '');
      const pPhoneClean = cleanId(p.phoneNumber || '');

      const senderMatches =
        senderId === (p.id || '') ||
        senderId === (p.lid || '') ||
        senderIdClean === pIdClean ||
        senderIdClean === pLidClean ||
        senderIdClean === pPhoneClean;

      return senderMatches && isAdminValue(p.admin);
    });

    return { isSenderAdmin, isBotAdmin };
  } catch (err) {
    console.error('Error in isAdmin:', err);
    return { isSenderAdmin: false, isBotAdmin: false };
  }
}

module.exports = isAdmin;