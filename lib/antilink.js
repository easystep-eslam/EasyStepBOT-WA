const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilinkSetting } = require('../lib/antilinkHelper');
const { incrementWarningCount, resetWarningCount, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { getLang } = require('../lib/lang');
const config = require('../config');

const WARN_COUNT = config.WARN_COUNT || 3;

function containsURL(str) {
  const urlRegex = /(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/i;
  return urlRegex.test(str);
}

function isBroadcastOrChannelJid(jid = '') {
  return (
    jid === 'status@broadcast' ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@channel')
  );
}

async function Antilink(msg, sock) {
  const jid = msg?.key?.remoteJid;
  if (!jid) return;

  // تجاهل القنوات/البرودكاست (تحويلات القنوات غالبًا تيجي هنا)
  if (isBroadcastOrChannelJid(jid)) return;

  // جروب فقط
  if (!isJidGroup(jid)) return;

  const lang = getLang(jid);

  const TXT = {
    en: {
      linkBlocked: (u) => `🔗 Links are not allowed here, @${u}.`,
      kicked: (u) => `🚫 @${u} has been removed for sending links.`,
      warn: (u, c, m) => `⚠️ Warning for @${u}: ${c}/${m} (links are not allowed).`,
      warnMax: (u, m) => `🚫 @${u} reached ${m} warnings and has been removed.`
    },
    ar: {
      linkBlocked: (u) => `🔗 الروابط ممنوعة هنا يا @${u}.`,
      kicked: (u) => `🚫 تم طرد @${u} بسبب إرسال روابط.`,
      warn: (u, c, m) => `⚠️ تحذير لـ @${u}: ${c}/${m} (الروابط ممنوعة).`,
      warnMax: (u, m) => `🚫 @${u} وصل لـ ${m} تحذيرات وتم طرده.`
    }
  };

  const T = TXT[lang] || TXT.ar;

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    '';

  if (!text || typeof text !== 'string') return;
  if (!containsURL(text.trim())) return;

  const sender = msg.key.participant;
  if (!sender) return;

  // تجاهل الأدمن والسودو
  try {
    const { isSenderAdmin } = await isAdmin(sock, jid, sender);
    if (isSenderAdmin) return;
  } catch {}

  try {
    if (await isSudo(sender)) return;
  } catch {}

  const action = getAntilinkSetting(jid);
  if (!action || action === 'off') return;

  try {
    // حذف الرسالة
    await sock.sendMessage(jid, { delete: msg.key });

    const userNum = sender.split('@')[0];

    switch (action) {
      case 'delete':
        await sock.sendMessage(jid, {
          text: T.linkBlocked(userNum),
          mentions: [sender]
        });
        break;

      case 'kick':
        await sock.groupParticipantsUpdate(jid, [sender], 'remove');
        await sock.sendMessage(jid, {
          text: T.kicked(userNum),
          mentions: [sender]
        });
        break;

      case 'warn': {
        const count = await incrementWarningCount(jid, sender);

        if (count >= WARN_COUNT) {
          await sock.groupParticipantsUpdate(jid, [sender], 'remove');
          await resetWarningCount(jid, sender);

          await sock.sendMessage(jid, {
            text: T.warnMax(userNum, WARN_COUNT),
            mentions: [sender]
          });
        } else {
          await sock.sendMessage(jid, {
            text: T.warn(userNum, count, WARN_COUNT),
            mentions: [sender]
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Antilink Error:', err);
  }
}

module.exports = { Antilink };