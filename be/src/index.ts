import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import path from 'path';
import { createServer } from 'http';

const app = express();
const port = process.env.PORT || 8080;

const frontendPath = path.resolve(__dirname, '../../fe/dist');
app.use(express.static(frontendPath));
app.use((_req, res) => {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

interface User {
    socket: WebSocket;
    room: string;
    username: string;
}

interface Message {
    message: string;
    username: string;
    timestamp: number;
}

let allSockets: User[] = [];
const roomMessages: Map<string, Message[]> = new Map();

function broadcast(room: string, payload: object, exclude?: WebSocket) {
    const data = JSON.stringify(payload);
    allSockets.forEach((user) => {
        if (user.room === room && user.socket !== exclude) {
            user.socket.send(data);
        }
    });
}

wss.on('connection', (socket) => {
    socket.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());

            if (parsed.type === 'join') {
                const { roomId, username } = parsed.payload;
                allSockets.push({ socket, room: roomId, username });

                // Send history to the new user
                const history = roomMessages.get(roomId) || [];
                socket.send(JSON.stringify({
                    type: 'history',
                    payload: { messages: history },
                }));

                // Notify others in the room
                broadcast(roomId, {
                    type: 'system',
                    payload: { message: `${username} joined the room` },
                }, socket);
            }

            if (parsed.type === 'chat') {
                const currentUser = allSockets.find((x) => x.socket === socket);
                if (!currentUser) return;

                const msg: Message = {
                    message: parsed.payload.message,
                    username: currentUser.username,
                    timestamp: Date.now(),
                };

                if (!roomMessages.has(currentUser.room)) {
                    roomMessages.set(currentUser.room, []);
                }
                roomMessages.get(currentUser.room)!.push(msg);

                broadcast(currentUser.room, { type: 'chat', payload: msg });
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    socket.on('close', () => {
        const user = allSockets.find((x) => x.socket === socket);
        if (user) {
            allSockets = allSockets.filter((x) => x.socket !== socket);
            broadcast(user.room, {
                type: 'system',
                payload: { message: `${user.username} left the room` },
            });
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
