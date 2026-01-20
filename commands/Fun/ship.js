const { getLang } = require('../../lib/lang');

async function react(sock, message, emoji) {
  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: emoji, key: message.key }
    });
  } catch {}
}

async function shipCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      notEnough: '❌ Not enough members to ship!',
      title: '💞 New Ship 💞',
      congrats: '✨ Congratulations 💍',
      failed: '❌ Failed to ship!'
    },
    ar: {
      groupOnly: '❌ الأمر ده للجروبات بس.',
      notEnough: '❌ عدد الأعضاء مش كفاية.',
      title: '💞 شـيـب جـديـد 💞',
      congrats: '✨ مبروك عليكم 💍',
      failed: '❌ حصل خطأ أثناء الشيب.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await react(sock, message, '💞');

    if (!chatId.endsWith('@g.us')) {
      await react(sock, message, '❌');
      return await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    }

    const metadata = await sock.groupMetadata(chatId);
    const participants = (metadata.participants || []).map(p => p.id).filter(Boolean);

    if (participants.length < 2) {
      await react(sock, message, '❌');
      return await sock.sendMessage(chatId, { text: T.notEnough }, { quoted: message });
    }

    const firstUser = participants[Math.floor(Math.random() * participants.length)];
    let secondUser = firstUser;
    while (secondUser === firstUser) {
      secondUser = participants[Math.floor(Math.random() * participants.length)];
    }

    const m1 = `@${firstUser.split('@')[0]}`;
    const m2 = `@${secondUser.split('@')[0]}`;

    const text = `${T.title}\n\n${m1} ❤️ ${m2}\n\n${T.congrats}`;

    await sock.sendMessage(
      chatId,
      { text, mentions: [firstUser, secondUser] },
      { quoted: message }
    );

    await react(sock, message, '✅');
  } catch (error) {
    console.error('Error in ship command:', error);
    await react(sock, message, '❌');
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'ship',
  aliases: ['ship', 'شيب', 'حب', 'couple', 'match'],
  category: {
    ar: '🎯 أوامر الترفيه',
    en: '🎯 Fun Commands'
  },
  description: {
    ar: 'يختار عضوين عشوائيًا من الجروب ويعمل لهم Ship.',
    en: 'Pick two random group members and ship them.'
  },
  usage: {
    ar: '.ship',
    en: '.ship'
  },
  emoji: '💘',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: shipCommand,
  run: shipCommand,
  execute: shipCommand
};