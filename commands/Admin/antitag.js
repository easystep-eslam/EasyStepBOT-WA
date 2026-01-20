const { setAntitag, getAntitag, removeAntitag } = require('../../lib/index');
const isAdmin = require('../../lib/isAdmin');
const { getLang } = require('../../lib/lang');

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    ''
  );
}

function getUsedCommand(message) {
  const raw = getText(message).trim();
  const first = (raw.split(/\s+/)[0] || '').toLowerCase();
  return first.startsWith('.') ? first.slice(1) : first;
}

async function safeReact(sock, chatId, key, emoji) {
  if (!key) return;
  try {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
  } catch {}
}

function TXT(chatId) {
  const lang = getLang(chatId);

  const dict = {
    en: {
      groupOnly: '❌ This command works in groups only.',
      botNeedAdmin: '❌ Please make the bot an admin first.',
      adminOnly: '❌ This command is for group admins only.',
      help:
        '*ANTITAG*\n\n' +
        '• .antitag on\n' +
        '• .antitag off\n' +
        '• .antitag set delete | kick\n' +
        '• .antitag get\n\n' +
        'Note: If action is not set, default is *delete*.',
      alreadyOn: '*_Antitag is already ON_*',
      alreadyOff: '*_Antitag is already OFF_*',
      turnedOn: '*_Antitag has been turned ON_*',
      turnedOff: '*_Antitag has been turned OFF_*',
      setNeedAction: '*_Please specify: .antitag set delete | kick_*',
      invalidAction: '*_Invalid action. Choose delete or kick._*',
      setOk: (a) => `*_Antitag action set to: ${a}_*`,
      config: (enabled, act) =>
        `*_Antitag Configuration:_*\nStatus: ${enabled ? 'ON' : 'OFF'}\nAction: ${act || 'Not set'}`,
      failedOn: '*_Failed to turn ON Antitag_*',
      failedSet: '*_Failed to set Antitag action_*',
      error: '❌ Error processing antitag command.'
    },
    ar: {
      groupOnly: '❌ الأمر ده شغال في الجروبات بس.',
      botNeedAdmin: '❌ لازم تخلي البوت أدمن الأول.',
      adminOnly: '❌ الأمر ده لمشرفين الجروب فقط.',
      help:
        '*منع التاج الكتير (Tagall)*\n\n' +
        '• .antitag on  - تشغيل\n' +
        '• .antitag off - إيقاف\n' +
        '• .antitag set delete | kick  - تحديد الإجراء\n' +
        '• .antitag get - عرض الإعدادات\n\n' +
        'ملحوظة: لو مش محدد إجراء، الافتراضي هو *delete*.',
      alreadyOn: '*_منع التاج مفعل بالفعل_*',
      alreadyOff: '*_منع التاج متوقف بالفعل_*',
      turnedOn: '*_تم تفعيل منع التاج_*',
      turnedOff: '*_تم إيقاف منع التاج_*',
      setNeedAction: '*_حدد الإجراء: .antitag set delete | kick_*',
      invalidAction: '*_إجراء غير صحيح. اختر: delete أو kick._*',
      setOk: (a) => `*_تم ضبط إجراء منع التاج إلى: ${a}_*`,
      config: (enabled, act) =>
        `*_إعدادات منع التاج:_*\nالحالة: ${enabled ? 'مفعل' : 'غير مفعل'}\nالإجراء: ${act || 'غير محدد'}`,
      failedOn: '*_فشل تفعيل منع التاج_*',
      failedSet: '*_فشل ضبط إجراء منع التاج_*',
      error: '❌ حصل خطأ أثناء تنفيذ أمر منع التاج.'
    }
  };

  return { lang, T: dict[lang] || dict.en };
}

function reactForAction(action, setAction) {
  if (!action) return 'ℹ️';
  if (action === 'on') return '🛡️';
  if (action === 'off') return '📴';
  if (action === 'get') return 'ℹ️';
  if (action === 'set') {
    if (setAction === 'delete') return '🗑️';
    if (setAction === 'kick') return '👢';
    return 'ℹ️';
  }
  return 'ℹ️';
}

async function antitagCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;

  const { lang, T } = TXT(chatId);

  if (!chatId.endsWith('@g.us')) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });
    return;
  }

  const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

  if (!isBotAdmin) {
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: T.botNeedAdmin }, { quoted: message });
    return;
  }

  if (!isSenderAdmin && !message.key.fromMe) {
    await safeReact(sock, chatId, message.key, '🚫');
    await sock.sendMessage(chatId, { text: T.adminOnly }, { quoted: message });
    return;
  }

  try {
    const used = getUsedCommand(message);
    let text = Array.isArray(args) && args.length ? args.join(' ').trim() : '';
    if (!text) {
      const raw = getText(message).trim();
      text = raw.slice((used ? used.length + 1 : 0)).trim();
    }

    const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    const action = (parts[0] || '').toLowerCase();
    const more = parts.slice(1);
    const setAction = (more[0] || '').toLowerCase();

    if (!action) {
      await safeReact(sock, chatId, message.key, 'ℹ️');
      await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
      return;
    }

    await safeReact(sock, chatId, message.key, reactForAction(action, setAction));

    if (action === 'on') {
      const cfg = await getAntitag(chatId, 'on');
      if (cfg?.enabled) {
        await sock.sendMessage(chatId, { text: T.alreadyOn }, { quoted: message });
        return;
      }

      const ok = await setAntitag(chatId, 'on', 'delete');
      if (!ok) await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: ok ? T.turnedOn : T.failedOn }, { quoted: message });
      return;
    }

    if (action === 'off') {
      const cfg = await getAntitag(chatId, 'on');
      if (!cfg?.enabled) {
        await sock.sendMessage(chatId, { text: T.alreadyOff }, { quoted: message });
        return;
      }

      await removeAntitag(chatId, 'on');
      await sock.sendMessage(chatId, { text: T.turnedOff }, { quoted: message });
      return;
    }

    if (action === 'set') {
      if (!setAction) {
        await sock.sendMessage(chatId, { text: T.setNeedAction }, { quoted: message });
        return;
      }

      if (!['delete', 'kick'].includes(setAction)) {
        await safeReact(sock, chatId, message.key, '❌');
        await sock.sendMessage(chatId, { text: T.invalidAction }, { quoted: message });
        return;
      }

      const ok = await setAntitag(chatId, 'on', setAction);
      if (!ok) await safeReact(sock, chatId, message.key, '❌');
      await sock.sendMessage(chatId, { text: ok ? T.setOk(setAction) : T.failedSet }, { quoted: message });
      return;
    }

    if (action === 'get') {
      const cfg = await getAntitag(chatId, 'on');
      const enabled = !!cfg?.enabled;
      const act = cfg?.action || (lang === 'ar' ? 'غير محدد' : 'Not set');
      await sock.sendMessage(chatId, { text: T.config(enabled, act) }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: T.help }, { quoted: message });
  } catch (error) {
    console.error('Error in antitag command:', error);
    await safeReact(sock, chatId, message.key, '❌');
    await sock.sendMessage(chatId, { text: TXT(chatId).T.error }, { quoted: message });
  }
}

async function handleTagDetection(sock, chatId, message, senderId) {
  try {
    const antitagSetting = await getAntitag(chatId, 'on');
    if (!antitagSetting?.enabled) return;

    const msgText = getText(message);
    const ctx = message.message?.extendedTextMessage?.contextInfo || {};
    const mentionedJids = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];

    const numericMentions = msgText.match(/@\d{8,}/g) || [];
    const uniqueNumericMentions = new Set();
    for (const mention of numericMentions) {
      const m = mention.match(/@(\d+)/);
      if (m?.[1]) uniqueNumericMentions.add(m[1]);
    }

    const mentionedJidCount = mentionedJids.length;
    const numericMentionCount = uniqueNumericMentions.size;
    const totalMentions = Math.max(mentionedJidCount, numericMentionCount);
    if (totalMentions < 3) return;

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants || [];
    const mentionThreshold = Math.ceil(participants.length * 0.5);

    const hasManyNumericMentions =
      numericMentionCount >= 10 ||
      (numericMentionCount >= 5 && numericMentionCount >= mentionThreshold);

    if (totalMentions < mentionThreshold && !hasManyNumericMentions) return;

    const action = antitagSetting.action || 'delete';
    const lang = getLang(chatId);

    try {
      await sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          fromMe: false,
          id: message.key.id,
          participant: senderId
        }
      });
    } catch {}

    if (action === 'kick') {
      try {
        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
      } catch {}

      await sock.sendMessage(
        chatId,
        {
          text:
            lang === 'ar'
              ? `🚫 *تم اكتشاف Tagall!*\n@${senderId.split('@')[0]} تم طرده بسبب عمل Tagall.`
              : `🚫 *Tagall Detected!*\n@${senderId.split('@')[0]} has been kicked for tagging all members.`,
          mentions: [senderId]
        },
        { quoted: message }
      );
      return;
    }

    await sock.sendMessage(
      chatId,
      { text: lang === 'ar' ? `⚠️ *تم اكتشاف Tagall!*` : `⚠️ *Tagall Detected!*` },
      { quoted: message }
    );
  } catch (error) {
    console.error('Error in tag detection:', error);
  }
}

module.exports = {
  name: 'antitag',
  aliases: ['antitag', 'منع_التاج', 'منع_التاج_الكتير'],
  category: {
    ar: '👮‍♂️ أدمن الجروب',
    en: '👮‍♂️ Group Admin'
  },
  description: {
    ar: 'منع Tagall داخل الجروب: يحذف رسالة التاج الكتير أو يطرد صاحبها حسب الإعدادات.',
    en: 'Prevents Tagall in the group: deletes the tagall message or kicks the sender based on settings.'
  },
  emoji: '🔕',

  admin: true,
  owner: false,
  showInMenu: true,
  run: antitagCommand,
  exec: antitagCommand,
  execute: (sock, message, args) => antitagCommand(sock, message, args),
  antitagCommand,
  handleTagDetection
};