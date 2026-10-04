const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Register: who is online in which room (socket id -> { name, room })
const onlineUsers = {};

// Send the online list of one room to everyone in that room
function sendOnlineList(room) {
  const names = Object.values(onlineUsers)
    .filter((user) => user.room === room)
    .map((user) => user.name);

  io.to(room).emit('online users', names);
}

io.on('connection', (socket) => {
  console.log('A user connected');

  // Someone joined with a name and a room
  socket.on('join', ({ name, room }) => {
    console.log('Joined:', name, '| room:', room);

    socket.username = name;
    socket.room = room;
    socket.join(room);
    onlineUsers[socket.id] = { name: name, room: room };

    // Tell only the people in that room
    socket.to(room).emit('system message', name + ' joined the chat 👋');
    sendOnlineList(room);
  });

  // Message goes only to the same room
  socket.on('chat message', (data) => {
    console.log('Server received message:', data);
    socket.to(socket.room).emit('chat message', data);
  });

  // Someone is typing (only in the same room)
  socket.on('typing', () => {
    socket.to(socket.room).emit('typing', socket.username);
  });

  // Stopped typing
  socket.on('stop typing', () => {
    socket.to(socket.room).emit('stop typing');
  });

  // Someone left
  socket.on('disconnect', () => {
    console.log('A user disconnected');

    if (socket.username) {
      delete onlineUsers[socket.id];

      io.to(socket.room).emit('system message', socket.username + ' left the chat 💔');
      io.to(socket.room).emit('stop typing');
      sendOnlineList(socket.room);
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running: http://localhost:3000');
});