"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
const frontendPath = path_1.default.resolve(__dirname, '../../fe/dist');
app.use(express_1.default.static(frontendPath));
app.use((_req, res) => {
    res.sendFile(path_1.default.resolve(frontendPath, 'index.html'));
});
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
let allSockets = [];
const roomMessages = new Map();
function broadcast(room, payload, exclude) {
    const data = JSON.stringify(payload);
    allSockets.forEach((user) => {
        if (user.room === room && user.socket !== exclude) {
            try {
                user.socket.send(data);
            }
            catch (err) {
                console.error(`Failed to send to user ${user.username}:`, err);
            }
        }
    });
}
wss.on('connection', (socket) => {
    socket.on('message', (data) => {
        var _a, _b, _c, _d;
        try {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'join') {
                // Prevent double-join on the same socket
                if (allSockets.some((x) => x.socket === socket))
                    return;
                const roomId = typeof ((_a = parsed.payload) === null || _a === void 0 ? void 0 : _a.roomId) === 'string' ? parsed.payload.roomId.trim().slice(0, 50) : '';
                const username = typeof ((_b = parsed.payload) === null || _b === void 0 ? void 0 : _b.username) === 'string' ? parsed.payload.username.trim().slice(0, 30) : '';
                if (!roomId || !username)
                    return;
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
                if (!currentUser)
                    return;
                const rawMessage = typeof ((_c = parsed.payload) === null || _c === void 0 ? void 0 : _c.message) === 'string' ? parsed.payload.message.trim().slice(0, 2000) : '';
                if (!rawMessage)
                    return;
                const msg = {
                    message: rawMessage,
                    username: currentUser.username,
                    timestamp: Date.now(),
                };
                if (!roomMessages.has(currentUser.room)) {
                    roomMessages.set(currentUser.room, []);
                }
                roomMessages.get(currentUser.room).push(msg);
                broadcast(currentUser.room, { type: 'chat', payload: msg });
            }
            if (parsed.type === 'typing') {
                const currentUser = allSockets.find((x) => x.socket === socket);
                if (!currentUser)
                    return;
                broadcast(currentUser.room, {
                    type: 'typing',
                    payload: { username: currentUser.username, isTyping: !!((_d = parsed.payload) === null || _d === void 0 ? void 0 : _d.isTyping) },
                }, socket);
            }
        }
        catch (e) {
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
