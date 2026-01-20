const fs = require('fs');

const path = require('path');

const settings = require('../../settings');

const { getLang } = require('../../lib/lang');

async function ownerCommand(sock, message) {

  const chatId = message.key.remoteJid;

  const lang = getLang(chatId);

  try {

    const ownerNumber =

      settings.owner ||

      settings.ownerNumber ||

      settings.ownerNumber1 ||

      '';

    const contact =

      ownerNumber

        ? `https://wa.me/${ownerNumber}`

        : (lang === 'ar' ? 'غير متوفر' : 'Not available');

    const TEXT = {

      ar:

        `👤 *مالك البوت*\n\n` +

        `🤖 *البوت:* EasyStep Bot\n` +

        `📛 *الاسم:* فريق EasyStep\n` +

        `📞 *التواصل:* ${contact}`,

      en:

        `👤 *Bot Owner*\n\n` +

        `🤖 *Bot:* EasyStep Bot\n` +

        `📛 *Name:* EasyStep Team\n` +

        `📞 *Contact:* ${contact}`

    };

    const imgPath = path.join(__dirname, '../../assets/bot_image.jpg');

    if (fs.existsSync(imgPath)) {

      const imgBuffer = fs.readFileSync(imgPath);

      await sock.sendMessage(

        chatId,

        {

          image: imgBuffer,

          caption: TEXT[lang] || TEXT.en

        },

        { quoted: message }

      );

    } else {

      await sock.sendMessage(

        chatId,

        { text: TEXT[lang] || TEXT.en },

        { quoted: message }

      );

    }

  } catch (err) {

    console.error('[OWNER]', err);

    await sock.sendMessage(

      chatId,

      {

        text:

          lang === 'ar'

            ? '❌ حصل خطأ أثناء عرض معلومات المالك'

            : '❌ Failed to show owner information'

      },

      { quoted: message }

    );

  }

}

module.exports = {

  name: 'owner',

  aliases: ['owner', 'المطور', 'المالك', 'dev', 'creator'],

  category: {

    ar: '🌐 أوامر عامة',

    en: '🌐 General Commands'

  },

  description: {

    ar: 'عرض معلومات مالك البوت',

    en: 'Show bot owner information'

  },

  usage: {

    ar: '.owner',

    en: '.owner'

  },

  emoji: '🧑‍💻',

  admin: false,

  owner: false,

  showInMenu: true,

  exec: ownerCommand,

  run: ownerCommand,

  execute: ownerCommand

};