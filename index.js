const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Lista de jugadores por sala
const rooms = {}; // { roomName: [player1, player2, ...] }
// Estado del juego por sala
const roomState = {
}; // { roomName: { hands, deck, discardPile, turnIndex, players } }


// === FUNCIONES AUXILIARES ===
function generateDeck() {
  const colors = ['R', 'G', 'B', 'Y'];
  const numbers = [...Array(12).keys()].map(n => n + 1);
  let deck = [];

  colors.forEach(color => {
    numbers.forEach(num => {
      deck.push(`${color}${num}`);
      deck.push(`${color}${num}`);
    });
  });

  deck.push('WILD', 'WILD', 'SKIP', 'SKIP');
  return deck;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// === SOCKET.IO ===
io.on('connection', (socket) => {
  // Crear sala ({Josue,sala1})
  socket.on('create_room', ({ name, room }) => {
    socket.data.name = name;
    socket.data.nameAdmin=name;
    socket.join(room);
    rooms[room] = rooms[room] || [];//rooms = { sala1: [] }
    rooms[room].push(name);//rooms = { sala1: ["Josue"] }
    io.to(room).emit('room_update', { players: rooms[room] });
    console.log(`Sala creada: ${room} por ${name}`);
  });

  // Unirse a sala
  socket.on('join_room', ({ name, room }) => {
    socket.data.name = name;
    socket.join(room);
    rooms[room] = rooms[room] || [];
    rooms[room].push(name);
    io.to(room).emit('room_update', { players: rooms[room] });
    console.log(`${name} se unió a la sala: ${room}`);
  });

  // Iniciar juego
  socket.on('start_game', ({ room }) => {
    const deck = shuffle(generateDeck());
    const topCard = deck.pop();
    const players = rooms[room];

    const hands = {};
    players.forEach(name => {
      hands[name] = deck.splice(0, 10);
    });

    roomState[room] = {
      turnIndex: 0,
      players,
      deck,
      discardPile: [topCard],
      hands,
      hasDrawn: players.reduce((acc, name) => {
        acc[name] = false;
        return acc;
      }, {})

    };

    players.forEach(playerName => {
      const playerSocket = [...io.sockets.sockets.values()].find(s =>
        s.rooms.has(room) && s.data.name === playerName
      );

      if (playerSocket) {
        playerSocket.emit('start_game', {
          hand: hands[playerName],
          turnPlayer: players[0],
          discardTop: topCard
        });
      }
      
    });

    console.log(`Juego iniciado en sala ${room}`);
    console.log(`Turno de ${rooms[room][roomState[room].turnIndex]}`);
    
  });

  // Robar carta
  socket.on('draw_card', ({ room, from }) => {
    const state = roomState[room];
    const player = socket.data.name;

    let drawn;
    if (from === 'deck') {
      drawn = state.deck.pop();
      console.log("Agarró la carta "+drawn+" del mazo")
    } else if (from === 'discard') {
      drawn = state.discardPile.pop();
      console.log("Agarró la carta "+drawn+" del mazo de descarte")
    }

    if (drawn) {
  state.hands[player].push(drawn);
  state.hasDrawn[player] = true; // ✅ Marcar que ya robó
  socket.emit('card_drawn', { card: drawn });
}
  });

  // Descartar carta
  socket.on('discard_card', ({ room, card }) => {
    const state = roomState[room];
    const player = socket.data.name;
    const hand = state.hands[player];

if (!state.hasDrawn[player]) {
  socket.emit('error_message', { message: 'Debes robar antes de descartar.' });
  console.log("Debes robar antes de descartar")
  return;
}

  socket.emit('discard_card_succesfully', { player })
    const index = hand.indexOf(card);
    if (index !== -1) {
      hand.splice(index, 1);
      state.discardPile.push(card);

      // Avanzar turno
      state.turnIndex = (state.turnIndex + 1) % state.players.length;
const nextPlayer = state.players[state.turnIndex];

// Resetear todos a false, luego activar solo el siguiente
Object.keys(state.hasDrawn).forEach(name => state.hasDrawn[name] = false);
    }
    io.to(room).emit('discard_update', {
      newTop: card,
      nextPlayer:state.players[0],
      discardedBy: player // ✅ NUEVO
    });
  });

  // (opcional) Jugar carta directamente (por ahora sin validación)
  socket.on('play_card', ({ room, card }) => {
    const state = roomState[room];
    const player = socket.data.name;
    const hand = state.hands[player];

    const index = hand.indexOf(card);
    if (index > -1) {
      hand.splice(index, 1);
    }

    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    const nextPlayer = state.players[state.turnIndex];

    io.to(room).emit('turn_update', { nextPlayer });
  });
});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
