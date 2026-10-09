# 💬 Mini Chat

A real-time, multi-room chat app with user profiles, photo avatars and persistent message history. Built with Node.js, Express, Socket.io and MySQL.

<img width="321" height="407" alt="image" src="https://github.com/user-attachments/assets/8b63bf03-22da-45a6-98a1-84c493e63cc2" />
<img width="335" height="552" alt="image" src="https://github.com/user-attachments/assets/c06df20a-695a-478d-837d-3a83e306b3d4" />
<img width="329" height="500" alt="image" src="https://github.com/user-attachments/assets/cfcb2c88-1a7a-4243-a3b3-a6974b182091" />
<img width="362" height="508" alt="image" src="https://github.com/user-attachments/assets/9f9589fd-76a6-4aac-bb71-6b575220d572" />


## ✨ Features

- **Real-time messaging** between multiple users (works on laptop and phone)
- **Chat rooms**: General, Study, Gossip and Gaming
- **User profiles**: choose a name and upload a photo or pick an emoji avatar
- **Photo viewer**: click any profile picture to see it larger
- **Persistent history**: the last 50 messages of a room are loaded from MySQL, with Today / Yesterday date labels
- **Delete messages**: delete for me, delete for everyone (your own messages), or clear the chat for me
- **Emoji picker**
- **Online users list** and **live typing indicator**
- **Remembers you**: your profile is saved in the browser and a refresh takes you back to your room
- **Responsive design**: works on mobile screens too

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Socket.io
- **Database:** MySQL (`mysql2`)
- **Frontend:** HTML, CSS and vanilla JavaScript
- **Config:** `dotenv`

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Fatima-art12/mini-chat.git
cd mini-chat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Make sure MySQL is installed and running, then run the SQL in `database.sql` (for example in MySQL Workbench). It creates the `mini_chat` database with the `messages` and `profiles` tables.

### 4. Add your settings

Copy `.env.example` to a new file named `.env` and fill in your own MySQL details:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=mini_chat
```

### 5. Start the server

```bash
node server.js
```

You should see `Database connected ✅` in the terminal. Open `http://localhost:3000` in two browser windows and start chatting!

> **Tip:** If MySQL is not set up, the chat still works in real time, it just does not save history.

### Try it on your phone

Connect your phone and laptop to the same WiFi, find your laptop's IP address (`ipconfig` on Windows) and open `http://YOUR-IP:3000` on the phone.

## 📁 Project Structure

```
mini-chat/
├── public/
│   ├── index.html      # All screens: profile, room picker, chat
│   └── style.css       # Styling and mobile layout
├── screenshots/        # Images used in this README
├── database.sql        # Database and table setup
├── .env.example        # Example settings (copy to .env)
├── server.js           # Express + Socket.io + MySQL server
└── package.json
```

## 🧠 How It Works

- Each user joins a **Socket.io room**, so messages only reach people in the same room.
- The server saves every message in MySQL and sends the last 50 messages to a user when they join.
- Profile photos are stored as a small 96px copy (used in chat bubbles) and a larger 320px copy (used in the photo viewer).
- Users can only delete their **own** messages for everyone. The server checks the sender before deleting.

## ⚠️ Notes

- There is no login system yet, so profiles are matched by name.
- Never commit your `.env` file. It is listed in `.gitignore`.

## 📚 What I Learned

- Real-time communication with WebSockets (Socket.io): rooms, broadcasting and acknowledgements
- Connecting a Node.js server to MySQL and writing safe parameterised queries
- Handling images in the browser with the Canvas API (resizing and cropping)
- Managing state with `localStorage` and `sessionStorage`
- Building a responsive UI without any framework
