// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static('public'));  // Serve static files like HTML, CSS, and client-side JS

// io.on('connection', (socket) => {
//     console.log('A player connected:', socket.id);

//     // Join a room
//     socket.on('joinRoom', ({ username, roomCode }) => {
//         socket.join(roomCode);
//         console.log(`${username} joined room: ${roomCode}`);

//         // Add player's name to socket
//         socket.username = username;

//         // Broadcast the list of players in the room to everyone
//         const playersInRoom = getPlayersInRoom(roomCode);
//         io.to(roomCode).emit('playersListUpdate', playersInRoom);
//     });

//     // Handle player disconnect
//     socket.on('disconnect', () => {
//         console.log('A player disconnected:', socket.id);
//         // Remove player and update the room list
//         const roomCode = [...socket.rooms][1];  // Get the room the player was in (skip the first entry which is the socket ID)
//         if (roomCode) {
//             const playersInRoom = getPlayersInRoom(roomCode);
//             io.to(roomCode).emit('playersListUpdate', playersInRoom);
//         }
//     });

//     // Function to get players in a specific room
//     function getPlayersInRoom(roomCode) {
//         const clients = io.sockets.adapter.rooms.get(roomCode) || new Set();
//         const players = Array.from(clients).map(id => io.sockets.sockets.get(id).username);
//         return players;
//     }
// });

// server.listen(3000, () => {
//     console.log('Server is running on port 3000');
// });



// ----- UPDATE 22 OCT
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create MySQL connection
const db = mysql.createConnection({
    host: 'localhost',      // Database host
    user: 'root',           // Database username
    password: 'mamank546',   // Database password
    database: 'suspicious_games' // Database name
});

// Connect to the database
db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Middleware to parse JSON bodies in requests
app.use(express.json());
app.use(express.static('public'));  // Serve static files like HTML, CSS, and client-side JS

// Function to get players in a specific room
function getPlayersInRoom(roomCode) {
    const clients = io.sockets.adapter.rooms.get(roomCode) || new Set();
    const players = Array.from(clients).map(id => io.sockets.sockets.get(id).username);
    return players;
}

// POST API to create a new room and join it
app.post('/create_room', (req, res) => {
    const { username, global } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Generate a random room code and check if it's unique in the database
    let roomCode = generateRoomCode();

    // Check if room code already exists in the database
    const checkRoomQuery = 'SELECT * FROM room WHERE room_code = ?';
    db.query(checkRoomQuery, [roomCode], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.length > 0) {
            // Room code already exists, generate a new one
            roomCode = generateRoomCode();
        }

        // Insert new room into the database
        const createRoomQuery = 'INSERT INTO room (room_master, room_code, public, has_start) VALUES (?, ?, ?, ?)';
        db.query(createRoomQuery, [username, roomCode, global, false], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to create room' });
            }

            // Room created successfully, now emit event to join the room
            io.once('connection', (socket) => {
                socket.join(roomCode);
                socket.username = username;

                // Send the updated player list in the room
                const playersInRoom = getPlayersInRoom(roomCode);
                io.to(roomCode).emit('playersListUpdate', playersInRoom);
            });

            res.status(200).json({ message: `${username} created and joined room ${roomCode}`, roomCode });
        });
    });
});

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // Join a room
    socket.on('joinRoom', ({ username, roomCode }) => {
        try {
            socket.join(roomCode);
            console.log(`${username} joined room: ${roomCode}`);

            // Add player's name to socket
            socket.username = username;

            // Broadcast the list of players in the room to everyone
            const playersInRoom = getPlayersInRoom(roomCode);
            io.to(roomCode).emit('playersListUpdate', playersInRoom);
        } catch (error) {
            console.error('Error joining room:', error);
        }
    });

    // Start Game
    socket.on('startGame', () => {
        try {
            const roomCode = [...socket.rooms][1]; // Get the room the player was in
            const players = getPlayersInRoom(roomCode);
            const assignedRoles = assignRoles(players);

            // Send the roles to the players
            players.forEach((player, index) => {
                const playerSocket = [...io.sockets.sockets].find(([_, s]) => s.username === player)[1];
                if (playerSocket) {
                    playerSocket.emit('assignRole', assignedRoles[index]);
                } else {
                    console.error(`Player socket not found for: ${player}`);
                }
            });

            // Redirect players to the announcement page after a slight delay
            setTimeout(() => {
                try {
                    io.to(roomCode).emit('redirectToAnnouncement');
                } catch (error) {
                    console.error('Error starting game:', error);
                }
            }, 1000); // Optional: delay to ensure roles are displayed first
        } catch (error) {
            console.error('Error starting game:', error);
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
        try {
            const roomCode = [...socket.rooms][1];  // Get the room the player was in
            if (roomCode) {
                const playersInRoom = getPlayersInRoom(roomCode);
                io.to(roomCode).emit('playersListUpdate', playersInRoom);
            }
        } catch (error) {
            console.error('Error during player disconnect:', error);
        }
    });
});


// Function to assign roles based on the number of players
function assignRoles(players) {
    const roles = [];
    const numPlayers = players.length;

    // Define role distribution based on player count
    if (numPlayers >= 5 && numPlayers <= 7) {
        roles.push("Mafia Politik"); // 1
        roles.push("Jurnalis"); // 1
        roles.push(...Array(numPlayers - 2).fill("Aktivis")); // Rest are Activists
    } else if (numPlayers >= 8 && numPlayers <= 10) {
        roles.push("Mafia Politik"); // 2 max
        roles.push("Mafia Politik");
        roles.push("Jurnalis"); // 1
        roles.push("KPK"); // 1
        roles.push("Kepolisian"); // 1
        roles.push(...Array(numPlayers - 5).fill("Aktivis")); // Rest are Activists
    } else if (numPlayers >= 11 && numPlayers <= 15) {
        roles.push("Mafia Politik"); // 3 max
        roles.push("Mafia Politik");
        roles.push("Mafia Politik");
        roles.push("Jurnalis"); // 1
        roles.push("KPK"); // 1
        roles.push("Kepolisian"); // 1
        roles.push(...Array(numPlayers - 6).fill("Aktivis")); // Rest are Activists
    }

    // Shuffle the roles array to randomize assignment
    roles.sort(() => Math.random() - 0.5);
    console.log(roles)

    return roles;
}

// Function to generate a random room code (example)
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Start the server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});