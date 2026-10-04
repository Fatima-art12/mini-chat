const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Register: abhi kaun kaun online hai (socket id -> naam)
const onlineUsers = {};

io.on('connection', (socket) => {
  console.log('Ek user connect hua');

  // Koi naam bata ke chat mein aya
  socket.on('join', (name) => {
    console.log('Join hua:', name);
    socket.username = name;
    onlineUsers[socket.id] = name;

    socket.broadcast.emit('system message', name + ' joined the chat 👋');

    // Nayi online list sab ko bhejo
    io.emit('online users', Object.values(onlineUsers));
  });

  // Message aaya to sab ko bhejo
  socket.on('chat message', (data) => {
    console.log('Server ko message mila:', data);
    socket.broadcast.emit('chat message', data);
  });

  // Koi likh raha hai
  socket.on('typing', () => {
    socket.broadcast.emit('typing', socket.username);
  });

  // Likhna band
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing');
  });

  // Koi chala gaya
  socket.on('disconnect', () => {
    console.log('User chala gaya');

    if (socket.username) {
      delete onlineUsers[socket.id];

      io.emit('system message', socket.username + ' left the chat 💔');
      io.emit('stop typing');

      // Nayi online list sab ko bhejo
      io.emit('online users', Object.values(onlineUsers));
    }
  });
});

server.listen(3000, () => {
  console.log('Server chal raha hai: http://localhost:3000');
});