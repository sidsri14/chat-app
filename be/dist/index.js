"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8080 });
let allSockets = [];
wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        var _a;
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.type == "join") {
            console.log("User joined", parsedMessage.roomId);
            allSockets.push({
                socket,
                room: parsedMessage.payload.roomId
            });
        }
        if (parsedMessage.type == "chat") {
            console.log("user wants to chat");
            const currentUserRoom = (_a = allSockets.find((x) => x.socket == socket)) === null || _a === void 0 ? void 0 : _a.room;
            // let currentUserRoom = null;
            // for(let i = 0; i<allSockets.length; i++) {
            //     if(allSockets[i].socket == socket) {
            //         currentUserRoom = allSockets[i].room;
            //     }
            // }
            for (let i = 0; i < allSockets.length; i++) {
                if (allSockets[i].room == currentUserRoom) {
                    allSockets[i].socket.send(parsedMessage.payload.message);
                }
            }
        }
    });
});
