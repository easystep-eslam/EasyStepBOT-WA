const settings = require('../../settings');
const { addSudo, removeSudo, getSudoList } = require('../../lib/index');
const isOwnerOrSudo = require('../../lib/isOwner');
const { getLang } = require('../../lib/lang');

function extractMentionedJid(message) {
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentioned.length > 0) return mentioned[0];

  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    '';

  const match = text.match(/\b(\d{7,15})\b/);
  if (match) return match[1] + '@s.whatsapp.net';

  return null;
}

async function sudoCommand(sock, message) {
  const chatId = message.key.remoteJid;
  const lang = getLang(chatId);

  await sock.sendMessage(chatId, {
    react: { text: '👑', key: message.key }
  }).catch(() => {});

  const TXT = {
    en: {
      usage:
        'Usage:\n.sudo add <@user|number>\n.sudo del <@user|number>\n.sudo list',
      noSudo: 'No sudo users set.',
      sudoUsers: 'Sudo users:\n',
      onlyOwner: '❌ Only owner can add/remove sudo users. Use .sudo list to view.',
      needTarget: 'Please mention a user or provide a number.',
      added: (jid) => `✅ Added sudo: ${jid}`,
      addFail: '❌ Failed to add sudo',
      ownerNoRemove: 'Owner cannot be removed.',
      removed: (jid) => `✅ Removed sudo: ${jid}`,
      removeFail: '❌ Failed to remove sudo'
    },
    ar: {
      usage:
        'الاستخدام:\n.sudo add <@شخص|رقم>\n.sudo del <@شخص|رقم>\n.sudo list',
      noSudo: 'مفيش يوزرز سودو متضافين.',
      sudoUsers: 'قائمة السـودو:\n',
      onlyOwner: '❌ الأمر ده للمالك بس (إضافة/حذف سودو). استخدم .sudo list للعرض.',
      needTarget: 'منشن الشخص أو ابعت رقمه.',
      added: (jid) => `✅ تم إضافة سودو: ${jid}`,
      addFail: '❌ فشل إضافة السـودو',
      ownerNoRemove: 'المالك مينفعش يتشال.',
      removed: (jid) => `✅ تم حذف السـودو: ${jid}`,
      removeFail: '❌ فشل حذف السـودو'
    }
  };

  const t = TXT[lang] || TXT.en;

  try {
    const senderJid = message.key.participant || message.key.remoteJid;
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);

    const rawText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      '';

    const args = rawText.trim().split(/\s+/).slice(1);
    const sub = (args[0] || '').toLowerCase();

    if (!sub || !['add', 'del', 'remove', 'list'].includes(sub)) {
      return await sock.sendMessage(chatId, { text: t.usage }, { quoted: message });
    }

    if (sub === 'list') {
      const list = await getSudoList();
      if (!Array.isArray(list) || list.length === 0) {
        return await sock.sendMessage(chatId, { text: t.noSudo }, { quoted: message });
      }

      const text = list.map((j, i) => `${i + 1}. ${j}`).join('\n');
      return await sock.sendMessage(chatId, { text: `${t.sudoUsers}${text}` }, { quoted: message });
    }

    if (!isOwner) {
      return await sock.sendMessage(chatId, { text: t.onlyOwner }, { quoted: message });
    }

    const targetJid = extractMentionedJid(message);
    if (!targetJid) {
      return await sock.sendMessage(chatId, { text: t.needTarget }, { quoted: message });
    }

    if (sub === 'add') {
      const ok = await addSudo(targetJid);
      return await sock.sendMessage(chatId, { text: ok ? t.added(targetJid) : t.addFail }, { quoted: message });
    }

    const ownerRaw = settings.ownerNumber || settings.owner || '';
    const ownerJid = ownerRaw ? `${ownerRaw}@s.whatsapp.net` : '';

    if (ownerJid && targetJid === ownerJid) {
      return await sock.sendMessage(chatId, { text: t.ownerNoRemove }, { quoted: message });
    }

    const ok = await removeSudo(targetJid);
    return await sock.sendMessage(chatId, { text: ok ? t.removed(targetJid) : t.removeFail }, { quoted: message });

  } catch (e) {
    console.error('[SUDO] Error:', e?.message || e);
    const msg = lang === 'ar' ? '❌ حصل خطأ أثناء تنفيذ الأمر.' : '❌ Error while processing command.';
    return await sock.sendMessage(chatId, { text: msg }, { quoted: message });
  }
}

module.exports = {
  name: 'sudo',
  aliases: ['sudo', 'superuser', 'root', 'سودو', 'صلاحيات', 'ادمن_خاص'],
  category: {
    ar: '👑 أوامر المالك',
    en: '👑 Owner Commands'
  },
  description: {
    ar: 'إضافة/حذف/عرض مستخدمي السـودو',
    en: 'Add/remove/list sudo users'
  },
  emoji: '🔑',
  admin: false,
  owner: true,
  showInMenu: true,
  exec: sudoCommand
};