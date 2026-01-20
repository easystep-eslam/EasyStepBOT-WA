const { getLang } = require('../../lib/lang');

async function staffCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      noAdmins: "❌ I couldn't find group admins.",
      fail: '❌ Failed to get admin list!',
      title: (name) => `≡ *GROUP ADMINS* _${name}_`,
      section: '*ADMINS*'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      noAdmins: '❌ ملقتش أدمنية في الجروب.',
      fail: '❌ فشل في جلب قائمة الأدمنية!',
      title: (name) => `≡ *إدارة الجروب* _${name}_`,
      section: '*الأدمنية*'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    if (!chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { react: { text: '👥', key: message.key } }).catch(() => {});

    const groupMetadata = await sock.groupMetadata(chatId);

    let pp;
    try {
      pp = await sock.profilePictureUrl(chatId, 'image');
    } catch {
      pp = 'https://i.imgur.com/2wzGhpF.jpeg';
    }

    const participants = groupMetadata.participants || [];
    const groupAdmins = participants.filter((p) => p.admin);

    if (!groupAdmins.length) {
      await sock.sendMessage(chatId, { text: T.noAdmins }, { quoted: message });
      return;
    }

    const listAdmin = groupAdmins
      .map((v, i) => `${i + 1}. @${String(v.id || '').split('@')[0]}`)
      .join('\n▢ ');

    const owner =
      groupMetadata.owner ||
      groupAdmins.find((p) => p.admin === 'superadmin')?.id ||
      chatId.split('-')[0] + '@s.whatsapp.net';

    const caption = `
${T.title(groupMetadata.subject)}

┌─⊷ ${T.section}
▢ ${listAdmin}
└───────────
`.trim();

    await sock.sendMessage(
      chatId,
      {
        image: { url: pp },
        caption,
        mentions: [...groupAdmins.map((v) => v.id), owner].filter(Boolean)
      },
      { quoted: message }
    );
  } catch (error) {
    console.error('Error in staff command:', error);
    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });
  }
}

module.exports = {
  name: 'staff',
  aliases: ['staff', 'admins', 'adminlist', 'ادمنية', 'الادمنية', 'إدارة_الجروب', 'ادارة_الجروب'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'عرض قائمة أدمنية الجروب.',
    en: 'Show the list of group admins.'
  },
  usage: {
    ar: '.staff',
    en: '.staff'
  },
  emoji: '🧑‍💼',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: staffCommand
};