const { getLang } = require('../../lib/lang');

/*
📝 شرح مختصر جدًا:
يعرض معلومات الجروب (الاسم/الآي دي/عدد الأعضاء/المالك/الأدمن/الوصف) مع صورة الجروب.
*/

async function groupInfoCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  const TXT = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      title: 'GROUP INFO',
      id: 'Group ID',
      name: 'Name',
      members: 'Members',
      owner: 'Owner',
      admins: 'Admins',
      desc: 'Description',
      noDesc: 'No description',
      none: 'None',
      failed: 'Failed to get group info!'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      title: 'معلومات الجروب',
      id: 'آي دي الجروب',
      name: 'الاسم',
      members: 'الأعضاء',
      owner: 'مالك الجروب',
      admins: 'المشرفين',
      desc: 'الوصف',
      noDesc: 'لا يوجد وصف',
      none: 'لا يوجد',
      failed: 'فشل في جلب معلومات الجروب!'
    }
  };

  const T = TXT[lang] || TXT.en;

  if (!chatId.endsWith('@g.us')) {
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  try {
    // ✅ React مناسب
    try {
      await sock.sendMessage(chatId, { react: { text: '👥', key: message.key } });
    } catch {}

    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata?.participants || [];

    // admin field may be: 'admin' | 'superadmin' | undefined
    const admins = participants.filter(p => !!p.admin);

    const ownerJid =
      metadata?.owner ||
      admins.find(a => a.admin === 'superadmin')?.id ||
      `${String(chatId).split('-')[0]}@s.whatsapp.net`;

    let ppUrl;
    try {
      ppUrl = await sock.profilePictureUrl(chatId, 'image');
    } catch {
      ppUrl = 'https://i.imgur.com/2wzGhpF.jpeg';
    }

    const adminList = admins.length
      ? admins.map((a, i) => `${i + 1}. @${a.id.split('@')[0]}`).join('\n')
      : T.none;

    const descText = metadata?.desc || T.noDesc;

    const caption = `
┌──「 *${T.title}* 」

▢ *${T.id}*
• ${metadata?.id || chatId}

▢ *${T.name}*
• ${metadata?.subject || '-'}

▢ *${T.members}*
• ${participants.length}

▢ *${T.owner}*
• @${String(ownerJid).split('@')[0]}

▢ *${T.admins}*
${adminList}

▢ *${T.desc}*
• ${descText}
    `.trim();

    const mentionJids = [
      ...admins.map(a => a.id),
      ownerJid
    ].filter(Boolean);

    await sock.sendMessage(
      chatId,
      {
        image: { url: ppUrl },
        caption,
        mentions: mentionJids
      },
      { quoted: message }
    );

  } catch (e) {
    console.error('[GROUPINFO]', e);
    await sock.sendMessage(chatId, { text: T.failed }, { quoted: message });
  }
}

module.exports = {
  name: 'groupinfo',
  aliases: ['groupinfo', 'ginfo', 'جروب_انفو'],
  category: {
    ar: '🌐 أوامر عامة',
    en: '🌐 General Commands'
  },
  description: {
    ar: 'يعرض معلومات الجروب (الاسم/الآي دي/الأعضاء/المالك/الأدمن/الوصف).',
    en: 'Show group info (name/id/members/owner/admins/description).'
  },
  usage: {
    ar: '.groupinfo / .ginfo',
    en: '.groupinfo / .ginfo'
  },
  emoji: '🏘️',
  admin: false,
  owner: false,
  showInMenu: true,
  run: groupInfoCommand,
  exec: groupInfoCommand
};