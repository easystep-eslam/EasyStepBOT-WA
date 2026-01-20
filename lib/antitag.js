const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { getLang } = require('../lib/lang');

function getTextFromMessage(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  );
}

async function handleAntitagCommand(sock, chatId, userMessage, senderId, _isSenderAdmin, message) {
  const lang = getLang(chatId);

  const TXT = {
    en: {
      onlyGroup: 'This command works in groups only.',
      botNotAdmin: 'Please make the bot an admin first.',
      onlyAdmins: 'For group admins only.',
      usage:
        `🛡️ *Antitag Setup*\n\n` +
        `.antitag on\n` +
        `.antitag set delete | kick\n` +
        `.antitag off\n` +
        `.antitag get`,
      alreadyOn: 'Antitag is already ON.',
      turnedOn: 'Antitag has been turned ON.',
      failedOn: 'Failed to turn on Antitag.',
      turnedOff: 'Antitag has been turned OFF.',
      needAction: 'Please specify an action: .antitag set delete | kick',
      invalidAction: 'Invalid action. Choose: delete or kick.',
      setTo: (a) => `Antitag action set to: *${a}*`,
      failedSet: 'Failed to set Antitag action.',
      configTitle: '*Antitag Configuration:*',
      status: (on) => `Status: ${on ? 'ON' : 'OFF'}`,
      action: (a) => `Action: ${a || 'Not set'}`,
      unknown: 'Use .antitag to see usage.',
      error: 'Error processing antitag command.'
    },
    ar: {
      onlyGroup: 'الأمر ده بيشتغل في الجروبات فقط.',
      botNotAdmin: 'لازم تخلي البوت أدمن الأول.',
      onlyAdmins: 'الأمر ده للأدمنز بس.',
      usage:
        `🛡️ *إعداد منع المنشن الجماعي*\n\n` +
        `.antitag on\n` +
        `.antitag set delete | kick\n` +
        `.antitag off\n` +
        `.antitag get`,
      alreadyOn: 'منع المنشن شغال بالفعل.',
      turnedOn: 'تم تشغيل منع المنشن بنجاح.',
      failedOn: 'فشل تشغيل منع المنشن.',
      turnedOff: 'تم إيقاف منع المنشن.',
      needAction: 'حدد الإجراء: .antitag set delete | kick',
      invalidAction: 'اختيار غير صحيح. استخدم: delete أو kick.',
      setTo: (a) => `تم ضبط الإجراء إلى: *${a}*`,
      failedSet: 'فشل ضبط الإجراء.',
      configTitle: '*إعدادات منع المنشن:*',
      status: (on) => `الحالة: ${on ? 'شغال' : 'مقفول'}`,
      action: (a) => `الإجراء: ${a || 'غير محدد'}`,
      unknown: 'اكتب .antitag لعرض طريقة الاستخدام.',
      error: 'حصل خطأ أثناء تنفيذ أمر antitag.'
    }
  };

  const T = TXT[lang] || TXT.en;

  try {
    if (!chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { text: T.onlyGroup }, { quoted: message });
      return;
    }

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isSenderAdmin && !message.key.fromMe) {
      await sock.sendMessage(chatId, { text: T.onlyAdmins }, { quoted: message });
      return;
    }

    const args = (userMessage || '').trim().split(/\s+/).slice(1);
    const action = (args[0] || '').toLowerCase();

    if (!action) {
      await sock.sendMessage(chatId, { text: T.usage }, { quoted: message });
      return;
    }

    if (action === 'on') {
      if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: T.botNotAdmin }, { quoted: message });
        return;
      }

      const existing = await getAntitag(chatId, 'on');
      if (existing?.enabled) {
        await sock.sendMessage(chatId, { text: T.alreadyOn }, { quoted: message });
        return;
      }

      const ok = await setAntitag(chatId, 'on', 'delete');
      await sock.sendMessage(chatId, { text: ok ? T.turnedOn : T.failedOn }, { quoted: message });
      return;
    }

    if (action === 'off') {
      await removeAntitag(chatId, 'on');
      await sock.sendMessage(chatId, { text: T.turnedOff }, { quoted: message });
      return;
    }

    if (action === 'set') {
      if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: T.botNotAdmin }, { quoted: message });
        return;
      }

      const setAction = (args[1] || '').toLowerCase();
      if (!setAction) {
        await sock.sendMessage(chatId, { text: T.needAction }, { quoted: message });
        return;
      }

      if (!['delete', 'kick'].includes(setAction)) {
        await sock.sendMessage(chatId, { text: T.invalidAction }, { quoted: message });
        return;
      }

      const ok = await setAntitag(chatId, 'on', setAction);
      await sock.sendMessage(chatId, { text: ok ? T.setTo(setAction) : T.failedSet }, { quoted: message });
      return;
    }

    if (action === 'get') {
      const cfg = await getAntitag(chatId, 'on');
      const enabled = !!cfg?.enabled;
      const act = cfg?.action;

      await sock.sendMessage(
        chatId,
        { text: `${T.configTitle}\n${T.status(enabled)}\n${T.action(act)}` },
        { quoted: message }
      );
      return;
    }

    await sock.sendMessage(chatId, { text: T.unknown }, { quoted: message });
  } catch (error) {
    console.error('Error in antitag command:', error);
    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });
  }
}

async function handleTagDetection(sock, chatId, message, senderId) {
  try {
    if (!chatId.endsWith('@g.us')) return;

    const antitagSetting = await getAntitag(chatId, 'on');
    if (!antitagSetting?.enabled) return;

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;
    if (!isBotAdmin) return;

    const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const messageText = getTextFromMessage(message);

    const numericMentions = messageText.match(/@\d{10,}/g) || [];
    const uniqueNumericMentions = new Set();
    for (const m of numericMentions) {
      const mm = m.match(/@(\d+)/);
      if (mm?.[1]) uniqueNumericMentions.add(mm[1]);
    }

    const mentionedJidCount = mentionedJids.length;
    const numericMentionCount = uniqueNumericMentions.size;
    const totalMentions = Math.max(mentionedJidCount, numericMentionCount);

    if (totalMentions < 3) return;

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants || [];
    const mentionThreshold = Math.ceil(participants.length * 0.5);

    const hasManyNumericMentions =
      numericMentionCount >= 10 || (numericMentionCount >= 5 && numericMentionCount >= mentionThreshold);

    if (!(totalMentions >= mentionThreshold || hasManyNumericMentions)) return;

    const lang = getLang(chatId);
    const TXT = {
      en: {
        warn: '⚠️ Tagall detected.',
        kicked: (u) => `🚫 Antitag detected.\n\n@${u} has been removed for tagging many members.`
      },
      ar: {
        warn: '⚠️ تم اكتشاف منشن جماعي (Tagall).',
        kicked: (u) => `🚫 تم اكتشاف منشن جماعي.\n\n@${u} تم إزالته بسبب منشن عدد كبير من الأعضاء.`
      }
    };
    const T = TXT[lang] || TXT.en;

    const action = antitagSetting.action || 'delete';

    await sock.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: message.key.id,
        participant: senderId
      }
    });

    if (action === 'delete') {
      await sock.sendMessage(chatId, { text: T.warn }, { quoted: message });
      return;
    }

    if (action === 'kick') {
      await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
      await sock.sendMessage(
        chatId,
        {
          text: T.kicked(senderId.split('@')[0]),
          mentions: [senderId]
        },
        { quoted: message }
      );
    }
  } catch (error) {
    console.error('Error in tag detection:', error);
  }
}

module.exports = {
  handleAntitagCommand,
  handleTagDetection
};