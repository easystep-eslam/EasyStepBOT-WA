const { getLang } = require('../../lib/lang');

async function warniCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      react: '🚨',
      groupOnly: '⚠️ This command works in groups only.',
      noAdmins: '⚠️ No admins found in this group.',
      failed: '❌ Failed to send warning. Please try again.'
    },
    ar: {
      react: '🚨',
      groupOnly: '⚠️ الأمر ده شغال في الجروبات بس.',
      noAdmins: '⚠️ لا يوجد أدمنية في الجروب.',
      failed: '❌ حصل خطأ أثناء إرسال التحذير. جرّب تاني.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    await sock.sendMessage(chatId, {
      react: { text: T.react, key: message.key }
    }).catch(() => {});

    if (!chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
      return;
    }

    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants || [];
    const groupAdmins = participants.filter(p => p.admin);

    if (!groupAdmins.length) {
      await sock.sendMessage(chatId, { text: T.noAdmins }, { quoted: message });
      return;
    }

    const adminList = groupAdmins
      .map((v, i) => `${i + 1}. @${String(v.id).split('@')[0]}`)
      .join('\n');

    const MESSAGE = {
      ar: `🚨 *تحذير هام* 🚨

يرجى العلم أنه يُمنع التعامل مع أي شخص على الخاص داخل الجروب  
والتعامل يكون مع *أدمن الجروب فقط* ✅

⚠️ مجالنا فيه عدد كبير من النصابين  
وأي عضو يتواصل معك على الخاص لا يمثل الإدارة ❌

👮‍♂️ *قائمة الأدمنية:*
${adminList}

‼️ *تنبيه مهم جدًا* ‼️  
*الرقم اللي باعت الرسالة ده رقم بوت* 🤖  
*ولا يمكنه المساعدة أو تنفيذ أي تعاملات نهائيًا*

✔️ *تعامل آمن = تعامل مع الأدمن فقط*`,

      en: `🚨 *Important Warning* 🚨

Private dealings with members are strictly forbidden.  
Always deal with *group admins only* ✅

⚠️ Our field contains many scammers.  
Anyone contacting you privately does NOT represent the management ❌

👮‍♂️ *Admin List:*
${adminList}

‼️ *Very Important Notice* ‼️  
*The number that sent this message is a BOT* 🤖  
*It cannot help or perform any transactions*

✔️ *Safe dealing = dealing with admins only*`
    };

    await sock.sendMessage(
      chatId,
      {
        text: MESSAGE[lang] || MESSAGE.en,
        mentions: groupAdmins.map(v => v.id)
      },
      { quoted: message }
    );

  } catch (err) {
    console.error('[WARNI]', err);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'warni',
  aliases: ['تحذير', 'warnin'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'إرسال رسالة تحذير عامة ضد التعامل على الخاص مع عرض الأدمنية.',
    en: 'Send a public anti-scam warning message showing group admins.'
  },
  usage: {
    ar: '.warni',
    en: '.warni'
  },
  emoji: '⚠️',

  admin: false,
  owner: false,
  showInMenu: true,
  exec: warniCommand,
  run: warniCommand,
  execute: warniCommand
};