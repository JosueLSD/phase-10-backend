const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const rooms = {}; // { roomName: [player1, player2, ...] }
/////////////funciones del juego/////////////|
function generateDeck() {
  const colors = ['R', 'G', 'B', 'Y']; // Rojo, Verde, Azul, Amarillo
  const numbers = [...Array(12).keys()].map(n => n + 1);
  let deck = [];

  colors.forEach(color => {
    numbers.forEach(num => {
      deck.push(`${color}${num}`);
      deck.push(`${color}${num}`); // Dos copias por carta
    });
  });

  deck.push('WILD', 'WILD', 'SKIP', 'SKIP'); // comodines
  return deck;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}
//////////////////////////////////

io.on('connection', (socket) => {
  socket.on('create_room', ({ name, room }) => {
    socket.data.name = name;
    socket.join(room);
    rooms[room] = rooms[room] || [];
    rooms[room].push(name);
    io.to(room).emit('room_update', { players: rooms[room] });
    console.log(`Sala creada: ${room} por ${name}`);
  });

  socket.on('join_room', ({ name, room }) => {
    socket.data.name = name;
    socket.join(room);
    rooms[room] = rooms[room] || [];
    rooms[room].push(name);
    io.to(room).emit('room_update', { players: rooms[room] });
    console.log(`${name} se unió a la sala: ${room}`);
  });

  socket.on('start_game', ({ room }) => {
  const deck = shuffle(generateDeck());
  const topCard = deck.pop();
  rooms[room].discardPile = [topCard];

  const playersInRoom = rooms[room];
  console.log(`Iniciando juego en la sala: ${room} con jugadores: ${playersInRoom}`);
  playersInRoom.forEach((playerName) => {
  console.log(`Repartiendo cartas a ${playerName} en la sala ${room}`);
  // Encuentra el socket del jugador en la sala
  const playerSocket = [...io.sockets.sockets.values()].find(s =>
    s.rooms.has(room) && s.data.name === playerName
  );
  console.log(`Socket del jugador ${playerName}:`, playerSocket ? playerSocket.id : 'No encontrado');
  // Reparte 10 cartas a cada jugador
  const hand = deck.splice(0, 10);

  rooms[room] = {
  turnIndex: 0,
  deck,
  players: playersInRoom,
  hands: {
    [playerName]: hand,
    //...
  }
};
  if (playerSocket) {
    playerSocket.emit('start_game', {
        hand,
        turnPlayer: playersInRoom[0],
        discardTop: topCard
    });
  }
  
  });
  });

  socket.on('play_card', ({ room, card }) => {
  const state = rooms[room];
  const playerName = socket.data.name;
  const hand = state.hands[playerName];

  socket.on('draw_card', ({ room, from }) => {
  const state = roomState[room];
  const player = socket.data.name;

  let drawn;
  if (from === 'deck') {
    drawn = state.deck.pop();
  } else if (from === 'discard') {
    drawn = state.discardPile.pop();
  }

  if (drawn) {
    state.hands[player].push(drawn);
    socket.emit('card_drawn', { card: drawn });
  }
  });

  socket.on('discard_card', ({ room, card }) => {
  const state = roomState[room];
  const player = socket.data.name;
  const hand = state.hands[player];

  const index = hand.indexOf(card);
  if (index !== -1) {
    hand.splice(index, 1);
    state.discardPile.push(card);

    // pasar turno
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    const nextPlayer = state.players[state.turnIndex];

    io.to(room).emit('discard_update', {
      newTop: card,
      nextPlayer
    });
  }
  });
  // eliminar carta de la mano
  const index = hand.indexOf(card);
  if (index > -1) {
    hand.splice(index, 1);
  }

  // actualizar turno
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  const nextPlayer = state.players[state.turnIndex];

  io.to(room).emit('turn_update', { nextPlayer });
  });


});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
