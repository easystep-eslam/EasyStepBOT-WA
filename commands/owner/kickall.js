const isAdmin = require('../../lib/isAdmin');

const { getLang } = require('../../lib/lang');

function TXT(chatId) {

  const ar = getLang(chatId) === 'ar';

  return {

    groupOnly: ar ? '❌ الأمر ده للجروبات بس.' : '❌ This command works in groups only.',

    needBotAdmin: ar ? '❌ لازم البوت يبقى أدمن الأول.' : '❌ Please make the bot an admin first.',

    ownerOnly: ar ? '❌ الأمر ده للأونر فقط.' : '❌ This command is for owner only.',

    starting: ar ? '🧹 جاري تصفية الجروب...' : '🧹 Cleaning up the group...',

    nothing: ar ? 'ℹ️ مفيش أعضاء عاديين للطرد (غير الأدمن).' : 'ℹ️ No non-admin members to remove.',

    done: (n) => (ar ? `✅ تم طرد ${n} عضو.` : `✅ Removed ${n} member(s).`),

    fail: ar ? '❌ حصل خطأ أثناء الطرد.' : '❌ Failed while removing members.'

  };

}

async function safeReact(sock, chatId, key, emoji) {

  if (!key) return;

  try {

    await sock.sendMessage(chatId, { react: { text: emoji, key } });

  } catch {}

}

function chunk(arr, size) {

  const out = [];

  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));

  return out;

}

function delay(ms) {

  return new Promise((r) => setTimeout(r, ms));

}

async function kickAllCommand(sock, message, args = []) {

  const chatId = message?.key?.remoteJid;

  if (!chatId) return;

  const T = TXT(chatId);

  // owner only

  const isOwner = !!message?.key?.fromMe;

  if (!isOwner) {

    await safeReact(sock, chatId, message?.key, '🚫');

    await sock.sendMessage(chatId, { text: T.ownerOnly }, { quoted: message });

    return;

  }

  if (!chatId.endsWith('@g.us')) {

    await safeReact(sock, chatId, message?.key, '🚫');

    await sock.sendMessage(chatId, { text: T.groupOnly }, { quoted: message });

    return;

  }

  // bot admin check (reuse your isAdmin helper)

  const senderId = message?.key?.participant || message?.key?.remoteJid;

  const adminStatus = await isAdmin(sock, chatId, senderId).catch(() => null);

  if (!adminStatus?.isBotAdmin) {

    await safeReact(sock, chatId, message?.key, '🛡️');

    await sock.sendMessage(chatId, { text: T.needBotAdmin }, { quoted: message });

    return;

  }

  // announce start

  await safeReact(sock, chatId, message?.key, '🧹');

  await sock.sendMessage(chatId, { text: T.starting }, { quoted: message });

  // get metadata participants

  let participants = [];

  try {

    const meta = await sock.groupMetadata(chatId);

    participants = Array.isArray(meta?.participants) ? meta.participants : [];

  } catch {

    participants = [];

  }

  // bot jid normalize

  const botId = sock.user?.id || '';

  const botPhone = String(botId).split(':')[0];

  const botJid = botPhone ? `${botPhone}@s.whatsapp.net` : '';

  // build removable list: non-admins only, exclude bot + owner (sender)

  const ownerJid = (message?.key?.participant || '').split(':')[0] || senderId;

  const removable = participants

    .filter((p) => {

      const jid = (p?.id || '').split(':')[0];

      if (!jid) return false;

      // keep admins/superadmins

      if (p?.admin) return false;

      // keep bot

      if (jid === botId || jid === botJid) return false;

      if (botJid && jid === botJid.replace('@s.whatsapp.net', '@lid')) return false;

      // keep owner (sender)

      if (jid === ownerJid) return false;

      return true;

    })

    .map((p) => (p.id || '').split(':')[0])

    .filter(Boolean);

  if (!removable.length) {

    await safeReact(sock, chatId, message?.key, 'ℹ️');

    await sock.sendMessage(chatId, { text: T.nothing }, { quoted: message });

    return;

  }

  // remove in batches to avoid rate limits

  const batches = chunk(removable, 20);

  let removedCount = 0;

  try {

    for (const b of batches) {

      // WhatsApp expects full JIDs often; keep as-is with @s.whatsapp.net if not present

      const jids = b.map((x) => (x.includes('@') ? x : `${x}@s.whatsapp.net`));

      await sock.groupParticipantsUpdate(chatId, jids, 'remove');

      removedCount += jids.length;

      // small delay between batches

      await delay(1200);

    }

    await safeReact(sock, chatId, message?.key, '✅');

    await sock.sendMessage(chatId, { text: T.done(removedCount) }, { quoted: message });

  } catch (err) {

    console.error('[KICKALL]', err);

    await safeReact(sock, chatId, message?.key, '❌');

    await sock.sendMessage(chatId, { text: T.fail }, { quoted: message });

  }

}

module.exports = {

  name: 'kickall',

  aliases: ['kickall', 'طرد_الكل', 'تصفيه', 'تصفية'],

 category: {

    ar: '👑 أوامر المالك',

    en: '👑 Owner Commands'

  },

  description: {

    ar: 'يطرد كل أعضاء الجروب ما عدا الأدمن. (للأونر فقط)',

    en: 'Kicks all non-admin members from the group (Owner only).'

  },

  usage: {

    ar: '.kickall',

    en: '.kickall'

  },

  emoji: '🧹',

  admin: false,

  owner: true,

  showInMenu: true,

  exec: kickAllCommand,

  run: kickAllCommand,

  execute: (sock, message, args) => kickAllCommand(sock, message, args)

};