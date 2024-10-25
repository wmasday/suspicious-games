const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'suspicious_games'
});

// Connect to the database
db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Middleware to parse JSON bodies in requests
app.use(express.json());
app.use(express.static('public'));

// Function to get players in a specific room
function getPlayersInRoom(roomCode) {
    const clients = io.sockets.adapter.rooms.get(roomCode) || new Set();
    const players = Array.from(clients).map(id => io.sockets.sockets.get(id).username);
    return players;
}


// Create Room
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

            // Get the newly created room ID
            const roomId = result.insertId;

            // Insert the creator into the role_on_room table
            const insertRoleQuery = `
                INSERT INTO role_on_room (room_id, username, role, alive, kill_to_user, vote_count, suspected) 
                VALUES (?, ?, NULL, TRUE, '', 0, FALSE)
            `;
            db.query(insertRoleQuery, [roomId, username], (err) => {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ error: 'Failed to add creator to role_on_room' });
                }

                // Room and role entry created successfully, now emit event to join the room
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
});


// Join Room
app.post('/join_room', (req, res) => {
    const { username, roomCode } = req.body;

    if (!username || !roomCode) {
        return res.status(400).json({ error: 'Username and Room Code are required' });
    }

    // Check if room exists and fetch room master
    const checkRoomQuery = 'SELECT id, room_master FROM room WHERE room_code = ?';
    db.query(checkRoomQuery, [roomCode], (err, roomResult) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (roomResult.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const roomId = roomResult[0].id;
        const roomMasterName = roomResult[0].room_master;

        // Check if username already exists in the room
        const checkUserQuery = 'SELECT * FROM role_on_room WHERE room_id = ? AND username = ?';
        db.query(checkUserQuery, [roomId, username], (err, userResult) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (userResult.length > 0) {
                return res.status(409).json({ error: 'Username already taken in this room' });
            }

            // Insert new player record into `role_on_room`
            const insertPlayerQuery = `
                INSERT INTO role_on_room (room_id, username, role, alive, kill_to_user, vote_count, suspected)
                VALUES (?, ?, NULL, true, '', 0, false)
            `;
            db.query(insertPlayerQuery, [roomId, username], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to add user to room' });
                }

                // Emit event to join the room and update players list
                io.once('connection', (socket) => {
                    socket.join(roomCode);
                    socket.username = username;

                    // Emit room master status based on comparison
                    const isRoomMaster = (username === roomMasterName);
                    socket.emit('roomMasterStatus', isRoomMaster);

                    const playersInRoom = getPlayersInRoom(roomCode);
                    io.to(roomCode).emit('playersListUpdate', playersInRoom);
                });

                res.status(200).json({ message: `Successfully joined room ${roomCode}`, roomCode });
            });
        });
    });
});

// Express endpoint to update global room status
app.post('/api/updateGlobalRoom', (req, res) => {
    const { roomCode, isGlobalRoom } = req.body;

    const query = `
        UPDATE room SET public = ? WHERE room_code = ?
    `;
    db.query(query, [isGlobalRoom, roomCode], (err) => {
        if (err) {
            console.error('Error updating global room status:', err);
            return res.status(500).send('Server error');
        }
        res.sendStatus(200); // Respond with success
    });
});


// Socket.IO connection with disconnect handler to remove user
io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('joinRoom', ({ username, roomCode }) => {
        // Store roomCode and username in the socket instance
        socket.roomCode = roomCode;
        socket.username = username;

        // Join the room
        socket.join(roomCode);

        // Query the database to check if the user is the room master
        const checkRoomMasterQuery = 'SELECT room_master FROM room WHERE room_code = ?';
        db.query(checkRoomMasterQuery, [roomCode], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return;
            }

            if (result.length > 0) {
                const roomMasterName = result[0].room_master;
                const isRoomMaster = (username === roomMasterName);

                // Emit room master status to the user
                socket.emit('roomMasterStatus', isRoomMaster);
            }

            // Emit updated player list to all clients in the room
            const playersInRoom = getPlayersInRoom(roomCode);
            io.to(roomCode).emit('playersListUpdate', playersInRoom);
        });

    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        const username = socket.username;

        if (roomCode && username) {
            // Remove user from role_on_room in the database
            const removeUserQuery = `
                DELETE FROM role_on_room
                WHERE room_id = (SELECT id FROM room WHERE room_code = ?) AND username = ?
            `;
            db.query(removeUserQuery, [roomCode, username], (err) => {
                if (err) {
                    console.error('Error removing user from role_on_room:', err);
                    return;
                }

                // Emit updated player list to all clients in the room
                const playersInRoom = getPlayersInRoom(roomCode);
                io.to(roomCode).emit('playersListUpdate', playersInRoom);
            });
        }
    });
});


// Function to generate a random room code (example)
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Start the server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
