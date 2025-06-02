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
    socket.join(room);
    rooms[room] = rooms[room] || [];
    rooms[room].push(name);
    io.to(room).emit('room_update', { players: rooms[room] });
  });

  socket.on('join_room', ({ name, room }) => {
    socket.join(room);
    rooms[room] = rooms[room] || [];
    rooms[room].push(name);
    io.to(room).emit('room_update', { players: rooms[room] });
  });

  socket.on('start_game', ({ room }) => {
  const deck = shuffle(generateDeck());
  const playersInRoom = rooms[room];

  playersInRoom.forEach((playerName, index) => {
    const playerSocket = [...io.sockets.sockets.values()].find(s =>
      s.rooms.has(room) && s.handshake.query.name === playerName
    );

    const hand = deck.splice(0, 10); // reparte 10 cartas a cada uno

    if (playerSocket) {
      playerSocket.emit('start_game', { hand });
    }
  });
  });

});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
