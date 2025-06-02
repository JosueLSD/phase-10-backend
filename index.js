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
});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
