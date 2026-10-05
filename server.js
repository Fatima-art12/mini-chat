require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Database connection (password .env file se aata hai)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5
});

// Startup par check karo ke database chal raha hai ya nahi
pool.query('SELECT 1')
  .then(() => console.log('Database connected ✅'))
  .catch((err) => console.log('Database NOT connected (chat will work, but no history):', err.message));

// Ek room ke aakhri 50 messages database se nikalo
async function getHistory(room) {
  const [rows] = await pool.query(
    'SELECT sender, text, time, created_at FROM messages WHERE room = ? ORDER BY id DESC LIMIT 50',
    [room]
  );

  // Naye pehle aaye the, ab purane pehle kar do
  return rows.reverse().map((row) => ({
    name: row.sender,
    text: row.text,
    time: row.time,
    date: row.created_at
  }));
}

// Ek message database mein save karo
async function saveMessage(room, sender, text, time) {
  await pool.query(
    'INSERT INTO messages (room, sender, text, time) VALUES (?, ?, ?, ?)',
    [room, sender, text, time]
  );
}

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
  socket.on('join', async ({ name, room }) => {
    console.log('Joined:', name, '| room:', room);

    socket.username = name;
    socket.room = room;
    socket.join(room);
    onlineUsers[socket.id] = { name: name, room: room };

    // Purane messages sirf is naye user ko bhejo
    try {
      const history = await getHistory(room);
      socket.emit('history', history);
    } catch (err) {
      console.log('Could not load history:', err.message);
    }

    // Tell only the people in that room
    socket.to(room).emit('system message', name + ' joined the chat 👋');
    sendOnlineList(room);
  });

  // Message goes only to the same room (aur database mein save hota hai)
  socket.on('chat message', async (data) => {
    if (!socket.room) return;

    console.log('Server received message:', data);
    socket.to(socket.room).emit('chat message', data);

    try {
      await saveMessage(socket.room, data.name, data.text, data.time);
    } catch (err) {
      console.log('Could not save message:', err.message);
    }
  });

  // Someone is typing (only in the same room)
  socket.on('typing', () => {
    if (!socket.room) return;
    socket.to(socket.room).emit('typing', socket.username);
  });

  // Stopped typing
  socket.on('stop typing', () => {
    if (!socket.room) return;
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

// Hosting gives us a port in process.env.PORT. On our laptop we use 3000.
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
});