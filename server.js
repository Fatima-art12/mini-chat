require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Sirf yeh rooms allowed hain (taake typing ki ghalti se naye rooms na banen)
const ROOMS = ['general', 'study', 'gossip', 'gaming'];

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

// Naam saaf karo (khali ho to Anonymous, 20 letters se lamba na ho)
function cleanName(name) {
  return String(name || '').trim().slice(0, 20) || 'Anonymous';
}

// Avatar check karo: ya to chhoti photo (data:image...) ya chhota emoji, warna khali
function cleanAvatar(avatar) {
  if (typeof avatar !== 'string') return '';
  if (avatar.startsWith('data:image/') && avatar.length < 60000) return avatar;
  if (!avatar.startsWith('data:') && avatar.length <= 8) return avatar;
  return '';
}

// Badi photo check karo (sirf JPEG tasveer, zyada bhari nahi)
function cleanPhoto(photo) {
  if (typeof photo !== 'string') return '';
  if (photo.startsWith('data:image/jpeg;base64,') && photo.length < 200000) return photo;
  return '';
}

// Ek room ke aakhri 50 messages nikalo (avatar aur id ke saath)
async function getHistory(room) {
  const [rows] = await pool.query(
    `SELECT m.id, m.sender, m.text, m.time, m.created_at, p.avatar
     FROM messages m
     LEFT JOIN profiles p ON p.name = m.sender
     WHERE m.room = ?
     ORDER BY m.id DESC
     LIMIT 50`,
    [room]
  );

  // Naye pehle aaye the, ab purane pehle kar do
  return rows.reverse().map((row) => ({
    id: row.id,
    name: row.sender,
    avatar: row.avatar || '',
    text: row.text,
    time: row.time,
    date: row.created_at
  }));
}

// Ek message database mein save karo aur uski id wapas do
async function saveMessage(room, sender, text, time) {
  const [result] = await pool.query(
    'INSERT INTO messages (room, sender, text, time) VALUES (?, ?, ?, ?)',
    [room, sender, text, time]
  );
  return result.insertId;
}

// Profile (naam + chhota avatar + badi photo) save ya update karo
async function saveProfile(name, avatar, photo) {
  await pool.query(
    `INSERT INTO profiles (name, avatar, photo) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE avatar = VALUES(avatar), photo = VALUES(photo)`,
    [name, avatar, photo]
  );
}

// NEW: kisi ki badi photo dikhane ka raasta: /photo?name=Fatima
app.get('/photo', async (req, res) => {
  const name = cleanName(req.query.name);

  try {
    const [rows] = await pool.query(
      'SELECT photo, avatar FROM profiles WHERE name = ?',
      [name]
    );

    const row = rows[0];
    if (!row) return res.status(404).end();

    // Badi photo ho to wo, warna chhoti wali
    const data = row.photo || row.avatar || '';
    const match = data.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(404).end();

    res.set('Content-Type', 'image/jpeg');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-cache');
    res.send(Buffer.from(match[1], 'base64'));
  } catch (err) {
    console.log('Could not load photo:', err.message);
    res.status(500).end();
  }
});

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

  // Someone joined with a profile (name + avatar + photo) and a room
  socket.on('join', async (data) => {
    const name = cleanName(data && data.name);
    const room = ROOMS.includes(data && data.room) ? data.room : 'general';
    const avatar = cleanAvatar(data && data.avatar);
    const photo = cleanPhoto(data && data.photo);

    console.log('Joined:', name, '| room:', room);

    socket.username = name;
    socket.room = room;
    socket.avatar = avatar;
    socket.join(room);
    onlineUsers[socket.id] = { name: name, room: room };

    // Profile database mein save karo
    try {
      await saveProfile(name, avatar, photo);
    } catch (err) {
      console.log('Could not save profile:', err.message);
    }

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
    if (!socket.room || !data) return;

    const text = String(data.text || '').slice(0, 1000);
    if (text.trim() === '') return;

    const time = String(data.time || '').slice(0, 20);
    const clientId = String(data.clientId || '').slice(0, 40);

    // Pehle database mein save karo, taake message ki id mil jaye
    let id = null;
    try {
      id = await saveMessage(socket.room, socket.username, text, time);
    } catch (err) {
      console.log('Could not save message:', err.message);
    }

    // Naam aur avatar server khud lagata hai, client se nahi leta
    const message = {
      id: id,
      name: socket.username,
      avatar: socket.avatar,
      text: text,
      time: time
    };

    console.log('Message in', socket.room, 'from', socket.username + ':', text);

    // Doosron ko message bhejo
    socket.to(socket.room).emit('chat message', message);

    // Bhejne wale ko uske message ki id wapas batao (taake wo delete kar sake)
    socket.emit('message saved', { clientId: clientId, id: id });
  });

  // Apna message sab ke liye delete karo (doosre ka message nahi hat sakta)
  socket.on('delete message', async (data) => {
    if (!socket.room || !data) return;

    const id = Number(data.id);
    if (!Number.isInteger(id)) return;

    try {
      // Sirf wahi delete hoga jo isi room ka ho aur isi user ka bheja hua ho
      const [result] = await pool.query(
        'DELETE FROM messages WHERE id = ? AND room = ? AND sender = ?',
        [id, socket.room, socket.username]
      );

      if (result.affectedRows > 0) {
        io.to(socket.room).emit('message deleted', { id: id });
      }
    } catch (err) {
      console.log('Could not delete message:', err.message);
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