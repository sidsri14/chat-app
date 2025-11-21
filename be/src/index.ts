import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import path from 'path';
import { createServer } from 'http';

const app = express();
const port = process.env.PORT || 8080;

// Serve static files from the frontend dist directory
const frontendPath = path.resolve(__dirname, '../../fe/dist');
console.log("Frontend Path:", frontendPath);
app.use(express.static(frontendPath));

// Catch-all route for SPA - serve index.html for any route
app.use((req, res) => {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
});

// Create HTTP server and attach WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server });

interface User {
    socket: WebSocket;
    room: string;
}

interface Message {
    message: string;
    timestamp: number;
}

let allSockets: User[] = [];
// Store message history per room (in-memory)
let roomMessages: Map<string, Message[]> = new Map();

wss.on("connection", (socket) => {

    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());

            if (parsedMessage.type == "join") {
                const roomId = parsedMessage.payload.roomId;
                console.log("User joined room " + roomId);

                allSockets.push({
                    socket,
                    room: roomId
                });

                // Send message history to the newly joined user
                const history = roomMessages.get(roomId) || [];
                if (history.length > 0) {
                    socket.send(JSON.stringify({
                        type: "history",
                        payload: {
                            messages: history.map(m => m.message)
                        }
                    }));
                }
            }

            if (parsedMessage.type == "chat") {
                console.log("user wants to chat");
                const currentUserRoom = allSockets.find((x) => x.socket == socket)?.room;

                if (currentUserRoom) {
                    const message = parsedMessage.payload.message;

                    // Store message in room history
                    if (!roomMessages.has(currentUserRoom)) {
                        roomMessages.set(currentUserRoom, []);
                    }
                    roomMessages.get(currentUserRoom)!.push({
                        message,
                        timestamp: Date.now()
                    });

                    // Broadcast to all users in the room
                    allSockets.forEach((user) => {
                        if (user.room == currentUserRoom) {
                            user.socket.send(message);
                        }
                    })
                }
            }
        } catch (e) {
            console.error("Error processing message:", e);
        }
    });

    socket.on("close", () => {
        allSockets = allSockets.filter((x) => x.socket != socket);
    });

})

// Start server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

