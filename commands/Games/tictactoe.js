const TicTacToe = require('../../lib/tictactoe');
const { getLang } = require('../../lib/lang');

const games = {};

function getTXT(lang) {
  const TXT = {
    en: {
      alreadyInGame: '❌ You are already in a game. Send *surrender* to quit.',
      waitingOpponent: '⏳ *Waiting for an opponent*\nSend *.ttt* to join.',
      notYourTurn: '❌ It is not your turn.',
      invalidMove: '❌ Invalid move. This spot is already taken.',
      errorStart: '❌ Failed to start the game. Please try again.',
      startedTitle: '🎮 *TicTacToe Started*',
      instructions: 'Instructions:\n• Send a number (1-9)\n• Send *surrender* to quit',
      turn: (u) => `🎲 Turn: @${u.split('@')[0]}`,
      waitingTurn: (u) => `⏳ Waiting for @${u.split('@')[0]}...`,
      surrenderEN: (s, w) =>
        `🏳️ @${s.split('@')[0]} surrendered.\n🏆 @${w.split('@')[0]} wins.`,
      win: (u) => `🏆 @${u.split('@')[0]} wins!`,
      draw: '🤝 Draw!'
    },
    ar: {
      alreadyInGame: '❌ أنت بالفعل داخل لعبة. اكتب *surrender* للخروج.',
      waitingOpponent: '⏳ *في انتظار لاعب آخر*\nاكتب *.ttt* للانضمام.',
      notYourTurn: '❌ ليس دورك الآن.',
      invalidMove: '❌ حركة غير صحيحة. هذا المكان مستخدم.',
      errorStart: '❌ حدث خطأ أثناء بدء اللعبة. حاول مرة أخرى.',
      startedTitle: '🎮 *بدأت لعبة XO*',
      instructions: 'التعليمات:\n• اكتب رقمًا من 1 إلى 9\n• اكتب *surrender* للاستسلام والخروج',
      turn: (u) => `🎲 الدور على: @${u.split('@')[0]}`,
      waitingTurn: (u) => `⏳ في انتظار: @${u.split('@')[0]}...`,
      surrenderAR: (s, w) =>
        `🏳️ @${s.split('@')[0]} استسلم.\n🏆 @${w.split('@')[0]} فاز.`,
      win: (u) => `🏆 @${u.split('@')[0]} فاز!`,
      draw: '🤝 تعادل!'
    }
  };

  return TXT[lang] || TXT.en;
}

function renderBoard(game) {
  const map = {
    X: '❎',
    O: '⭕',
    1: '1️⃣',
    2: '2️⃣',
    3: '3️⃣',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣'
  };

  const arr = game.render().map((v) => map[v]);
  return `${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}`;
}

function findUserRoom(senderId) {
  return Object.values(games).find(
    (r) =>
      r.id.startsWith('tictactoe') &&
      r.state === 'PLAYING' &&
      [r.game.playerX, r.game.playerO].includes(senderId)
  );
}

function findWaitingRoom(roomName) {
  return Object.values(games).find((r) => r.state === 'WAITING' && (roomName ? r.name === roomName : true));
}

async function safeSend(sock, chatId, payload, opts) {
  try {
    return await sock.sendMessage(chatId, payload, opts);
  } catch {}
}

async function safeReact(sock, chatId, messageKey, emoji) {
  try {
    if (!messageKey) return;
    await sock.sendMessage(chatId, { react: { text: emoji, key: messageKey } });
  } catch {}
}

async function startOrJoin(sock, chatId, senderId, roomName) {
  const lang = getLang(chatId);
  const T = getTXT(lang);

  try {
    const inGame = Object.values(games).find(
      (r) => r.id.startsWith('tictactoe') && [r.game.playerX, r.game.playerO].includes(senderId)
    );

    if (inGame) {
      await safeSend(sock, chatId, { text: T.alreadyInGame });
      return;
    }

    let room = findWaitingRoom(roomName);

    if (room) {
      room.o = chatId;
      room.game.playerO = senderId;
      room.state = 'PLAYING';

      const turn = room.game.currentTurn;

      const msg =
        `${T.startedTitle}\n\n` +
        `${T.waitingTurn(turn)}\n\n` +
        `${renderBoard(room.game)}\n\n` +
        `${T.instructions}`;

      await safeSend(sock, chatId, {
        text: msg,
        mentions: [room.game.playerX, room.game.playerO]
      });

      return;
    }

    room = {
      id: 'tictactoe-' + Date.now(),
      x: chatId,
      o: '',
      game: new TicTacToe(senderId, 'o'),
      state: 'WAITING'
    };

    if (roomName) room.name = roomName;
    games[room.id] = room;

    await safeSend(sock, chatId, { text: T.waitingOpponent });
  } catch (err) {
    console.error('[TTT] start/join error:', err);
    await safeSend(sock, chatId, { text: T.errorStart });
  }
}

async function handleMove(sock, chatId, senderId, text, messageKey) {
  const lang = getLang(chatId);
  const T = getTXT(lang);

  try {
    const room = findUserRoom(senderId);
    if (!room) return;

    const clean = String(text || '').trim();
    const isSurrender = /^(surrender|give up)$/i.test(clean);
    const isMove = /^[1-9]$/.test(clean);

    if (!isSurrender && !isMove) return;

    if (!isSurrender && senderId !== room.game.currentTurn) {
      await safeSend(sock, chatId, { text: T.notYourTurn });
      return;
    }

    const ok = isSurrender ? true : room.game.turn(senderId === room.game.playerO, parseInt(clean, 10) - 1);

    if (!ok) {
      await safeSend(sock, chatId, { text: T.invalidMove });
      return;
    }

    if (isSurrender) {
      const winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;

      await safeReact(sock, chatId, messageKey, '🏳️');

      const msg = lang === 'ar' ? T.surrenderAR(senderId, winner) : T.surrenderEN(senderId, winner);

      await safeSend(sock, chatId, { text: msg, mentions: [senderId, winner] });
      delete games[room.id];
      return;
    }

    const winner = room.game.winner;
    const isTie = room.game.turns === 9;

    let status = '';
    if (winner) {
      status = T.win(winner);
      await safeReact(sock, chatId, messageKey, '🏆');
    } else if (isTie) {
      status = T.draw;
      await safeReact(sock, chatId, messageKey, '🤝');
    } else {
      status = T.turn(room.game.currentTurn);
      await safeReact(sock, chatId, messageKey, '🎲');
    }

    const msg = `${status}\n\n${renderBoard(room.game)}`;

    await safeSend(sock, chatId, {
      text: msg,
      mentions: [room.game.playerX, room.game.playerO]
    });

    if (winner || isTie) delete games[room.id];
  } catch (err) {
    console.error('[TTT] move error:', err);
  }
}

async function tttCommand(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;

  const roomName = Array.isArray(args) && args.length ? args.join(' ').trim() : '';

  await safeReact(sock, chatId, message.key, '🎮');
  return startOrJoin(sock, chatId, senderId, roomName);
}

async function tttOnText(sock, message, text) {
  const chatId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  return handleMove(sock, chatId, senderId, (text || '').trim(), message.key);
}

/* =========  Metadata (DO NOT edit above this line)  ========= */

module.exports = {
  name: 'ttt',
  aliases: ['tictactoe', 'xo', 'xoo', 'اكسو', 'اكس_او', 'تيكتاك', 'لعبة_xo'],
  category: {
    ar: '🎲 ألعاب ترفيهية',
    en: '🎲 Fun Games'
  },
  description: {
    ar: 'لعبة XO داخل الجروب: ابدأ أو انضم ثم اكتب رقم 1-9، واكتب surrender للاستسلام.',
    en: 'Group TicTacToe: start/join then send a number 1-9, and send surrender to quit.'
  },
  usage: {
    ar: '.ttt (اختياري: اسم روم)',
    en: '.ttt (optional: room name)'
  },
  emoji: '🎮',
  admin: false,
  owner: false,
  showInMenu: true,
  exec: tttCommand,
  run: tttCommand,
  execute: (sock, message, args) => tttCommand(sock, message, args),
  onText: tttOnText
};