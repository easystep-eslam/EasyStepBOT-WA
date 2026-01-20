const { handleWelcome } = require('../../lib/welcome');

const { isWelcomeOn, getWelcome } = require('../../lib/index');

const { getLang } = require('../../lib/lang');

const { buildWelcomeCard } = require('../../lib/welcomeCard');

const axios = require('axios');

let cachedWelcomeTemplate = null;

let cachedWelcomeTemplateAt = 0;

async function getWelcomeTemplateBuffer() {

  const url = process.env.WELCOME_TEMPLATE_URL;

  if (!url) return null;

  const now = Date.now();

  if (cachedWelcomeTemplate && now - cachedWelcomeTemplateAt < 10 * 60 * 1000) return cachedWelcomeTemplate;

  try {

    const r = await axios.get(url, {

      responseType: 'arraybuffer',

      timeout: 20000,

      validateStatus: (s) => s >= 200 && s < 400

    });

    cachedWelcomeTemplate = Buffer.from(r.data);

    cachedWelcomeTemplateAt = now;

    return cachedWelcomeTemplate;

  } catch {

    return null;

  }

}

async function safeReact(sock, chatId, key, emoji) {

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

function formatDateParts(lang, date = new Date()) {

  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';

  const dateString = date.toLocaleDateString(locale, {

    year: 'numeric',

    month: '2-digit',

    day: '2-digit'

  });

  const timeOnly = date.toLocaleTimeString(locale, {

    hour: '2-digit',

    minute: '2-digit',

    second: '2-digit',

    hour12: true

  });

  const dateTime = date.toLocaleString(locale, {

    month: '2-digit',

    day: '2-digit',

    year: 'numeric',

    hour: '2-digit',

    minute: '2-digit',

    second: '2-digit',

    hour12: true

  });

  return { dateString, timeOnly, dateTime };

}

function applyWelcomeVars(template, vars) {

  return String(template || '')

    // New @-style vars

    .replace(/@name/g, vars.mentionTag)

    .replace(/@user/g, vars.mentionTag)

    .replace(/@number/g, vars.userNum)

    .replace(/@group/g, vars.groupName)

    .replace(/@description/g, vars.groupDesc)

    .replace(/@date/g, vars.dateString)

    .replace(/@time/g, vars.timeOnly)

    .replace(/@datetime/g, vars.dateTime)

    .replace(/@count/g, String(vars.count))

    // Backward compatibility: old {var} style

    .replace(/{user}/g, vars.mentionTag)

    .replace(/{group}/g, vars.groupName)

    .replace(/{description}/g, vars.groupDesc);

}

async function handleJoinEvent(sock, id, participants) {

  const isWelcomeEnabled = await isWelcomeOn(id);

  if (!isWelcomeEnabled) return;

  const lang = getLang(id);

  const customMessage = await getWelcome(id);

  const groupMetadata = await sock.groupMetadata(id);

  const groupName = groupMetadata?.subject || '';

  const groupDesc =

    groupMetadata?.desc || (lang === 'ar' ? 'لا يوجد وصف' : 'No description available');

  for (const participant of participants) {

    try {

      const participantString =

        typeof participant === 'string'

          ? participant

          : participant?.id || participant?.toString?.() || '';

      if (!participantString.includes('@')) continue;

      const userNum = participantString.split('@')[0];

      const mentionTag = `@${userNum}`;

      let displayName = userNum;

      try {

        const contact = await sock.getBusinessProfile(participantString);

        if (contact?.name) {

          displayName = contact.name;

        } else {

          const groupParticipants = groupMetadata?.participants || [];

          const userParticipant = groupParticipants.find((p) => p.id === participantString);

          if (userParticipant?.name) displayName = userParticipant.name;

        }

      } catch {}

      const now = new Date();

      const { dateString, timeOnly, dateTime } = formatDateParts(lang, now);

      const count = (groupMetadata?.participants || []).length;

      let finalMessage = '';

      if (customMessage) {

        finalMessage = applyWelcomeVars(customMessage, {

          lang,

          userNum,

          mentionTag,

          displayName,

          groupName,

          groupDesc,

          dateString,

          timeOnly,

          dateTime,

          count

        });

      } else {

        const DEF = {

          en:

            `╭╼━≪• NEW MEMBER •≫━╾╮\n` +

            `┃ WELCOME: ${mentionTag} 👋\n` +

            `┃ Member count: #${count}\n` +

            `┃ TIME: ${dateTime} ⏰\n` +

            `╰━━━━━━━━━━━━━━━╯\n\n` +

            `*${mentionTag}* Welcome to *${groupName}*! 🎉\n` +

            `*GROUP DESCRIPTION*\n${groupDesc}\n\n` +

            `> *Powered by EasyStep*`,

          ar:

            `╭╼━≪• عضو جديد •≫━╾╮\n` +

            `┃ أهلاً: ${mentionTag} 👋\n` +

            `┃ عدد الأعضاء: #${count}\n` +

            `┃ الوقت: ${dateTime} ⏰\n` +

            `╰━━━━━━━━━━━━━━━╯\n\n` +

            `*${mentionTag}* نورت/ي *${groupName}*! 🎉\n` +

            `*وصف الجروب*\n${groupDesc}\n\n` +

            `> *بواسطة EasyStep*`

        };

        finalMessage = DEF[lang] || DEF.en;

      }

      try {

        let profilePicUrl = null;

        try {

          const profilePic = await sock.profilePictureUrl(participantString, 'image');

          if (profilePic) profilePicUrl = profilePic;

        } catch {}

        let avatarBuffer = null;

        if (profilePicUrl) {

          try {

            const r = await axios.get(profilePicUrl, {

              responseType: 'arraybuffer',

              timeout: 15000,

              validateStatus: (s) => s >= 200 && s < 400

            });

            avatarBuffer = Buffer.from(r.data);

          } catch {}

        }

        const templateBuffer = await getWelcomeTemplateBuffer();

        const card = await buildWelcomeCard({

          lang,

          groupName,

          phoneNumber: userNum,

          joinedAt: Date.now(),

          avatarBuffer,

          templateBuffer

        });

        await sock.sendMessage(id, {

          image: card,

          caption: finalMessage,

          mentions: [participantString]

        });

        continue;

      } catch {}

      await sock.sendMessage(id, {

        text: finalMessage,

        mentions: [participantString]

      });

    } catch (error) {

      console.error('Error sending welcome message:', error);

      try {

        const participantString =

          typeof participant === 'string'

            ? participant

            : participant?.id || participant?.toString?.() || '';

        if (!participantString.includes('@')) continue;

        const userNum = participantString.split('@')[0];

        const mentionTag = `@${userNum}`;

        const now = new Date();

        const { dateString, timeOnly, dateTime } = formatDateParts(lang, now);

        const count = (groupMetadata?.participants || []).length;

        let fallbackMessage = '';

        if (customMessage) {

          fallbackMessage = applyWelcomeVars(customMessage, {

            lang,

            userNum,

            mentionTag,

            displayName: userNum,

            groupName,

            groupDesc,

            dateString,

            timeOnly,

            dateTime,

            count

          });

        } else {

          fallbackMessage =

            lang === 'ar'

              ? `أهلاً ${mentionTag} في ${groupName}! 🎉`

              : `Welcome ${mentionTag} to ${groupName}! 🎉`;

        }

        await sock.sendMessage(id, {

          text: fallbackMessage,

          mentions: [participantString]

        });

      } catch {}

    }

  }

}

async function welcomeCommand(sock, message) {

  const chatId = message?.key?.remoteJid;

  if (!chatId) return;

  const lang = getLang(chatId);

  const TXT = {

    en: {

      groupOnly: 'This command can only be used in groups.',

      error: '❌ Something went wrong. Please try again.'

    },

    ar: {

      groupOnly: 'الأمر ده بيشتغل في الجروبات فقط.',

      error: '❌ حصل خطأ أثناء تنفيذ أمر الترحيب.'

    }

  };

  const T = TXT[lang] || TXT.en;

  await safeReact(sock, chatId, message.key, '👋');

  if (!chatId.endsWith('@g.us')) {

    await safeReact(sock, chatId, message.key, '❌');

    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });

    return;

  }

  try {

    const rawText =

      message.message?.conversation?.trim() ||

      message.message?.extendedTextMessage?.text?.trim() ||

      message.message?.imageMessage?.caption?.trim() ||

      message.message?.videoMessage?.caption?.trim() ||

      '';

    const used = (rawText || '').split(/\s+/)[0] || '.welcome';

    const matchText = String(rawText || '').slice(used.length).trim();

    await handleWelcome(sock, chatId, message, matchText);

    await safeReact(sock, chatId, message.key, '✅');

  } catch (e) {

    console.error('[WELCOME CMD]', e?.stack || e);

    await safeReact(sock, chatId, message.key, '❌');

    await sock.sendMessage(chatId, { text: T.error }, { quoted: message });

  }

}

module.exports = {

  name: 'welcome',

  aliases: ['wel', 'setwelcome', 'ترحيب', 'الترحيب', 'الترحيب_المخصص'],

  category: {

    ar: '🛠️ إدارة الجروب',

    en: '🛠️ Group Management'

  },

  description: {

    ar:

      'تشغيل/إعداد رسالة ترحيب للأعضاء الجدد في الجروب مع دعم رسالة مخصصة ومتغيرات بصيغة @ مثل: @name @group @description @date @time @datetime @count (ويدعم القديم {user} للتوافق).',

    en:

      'Enable/configure welcome messages for new group members, with custom template support and @-style variables like: @name @group @description @date @time @datetime @count (also supports legacy {user}).'

  },

  usage: {

    ar:

      '.welcome (إعدادات الترحيب)\n\n' +

      'متغيرات الرسالة المخصصة:\n' +

      '• @name = منشن العضو\n' +

      '• @number = رقم العضو\n' +

      '• @group = اسم الجروب\n' +

      '• @description = وصف الجروب\n' +

      '• @date = التاريخ\n' +

      '• @time = الوقت\n' +

      '• @datetime = تاريخ + وقت\n' +

      '• @count = عدد الأعضاء',

    en:

      '.welcome (welcome settings)\n\n' +

      'Custom message variables:\n' +

      '• @name = mention user\n' +

      '• @number = user number\n' +

      '• @group = group name\n' +

      '• @description = group description\n' +

      '• @date = date\n' +

      '• @time = time\n' +

      '• @datetime = date + time\n' +

      '• @count = member count'

  },
emoji: '🤝',

  admin: true,

  owner: false,

  showInMenu: true,

  exec: welcomeCommand,

  run: welcomeCommand,

  execute: (sock, message, args) => welcomeCommand(sock, message, args),

  handleJoinEvent

};