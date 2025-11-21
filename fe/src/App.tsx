import { useEffect, useRef, useState } from "react";

function App() {
  const [messages, setMessages] = useState<string[]>([]);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);

  const joinRoom = () => {
    const room = roomInputRef.current?.value;
    if (room && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "join",
        payload: {
          roomId: room
        }
      }));
      setRoomId(room);
      setJoined(true);
    }
  };

  const sendMessage = () => {
    const message = inputRef.current?.value;
    if (message && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        payload: {
          message
        },
      }));
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.DEV ? "ws://localhost:8080" : `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        // Try to parse as JSON first (for history messages)
        const parsed = JSON.parse(event.data);
        if (parsed.type === "history") {
          // Load message history
          setMessages(parsed.payload.messages);
        }
      } catch {
        // If not JSON, it's a regular message
        setMessages(m => [...m, event.data]);
      }
    }

    wsRef.current = ws;

    return () => {
      ws.close();
    }
  }, []);

  if (!joined) {
    return (
      <div className="flex flex-col bg-black text-white h-screen w-screen items-center justify-center">
        <div className="p-8 bg-gray-900 rounded-lg flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center">Join a Room</h1>
          <input
            ref={roomInputRef}
            placeholder="Enter Room ID"
            className="p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={joinRoom}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 font-bold"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-black text-white h-screen w-screen items-center justify-center">
      <header className="p-4 text-center font-bold text-2xl w-full bg-gray-900 border-b border-gray-800">
        Chat App - Room: {roomId}
      </header>

      <div className="flex-grow p-4 overflow-y-auto w-full max-w-2xl">
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => (
            <div key={index} className="self-start bg-gray-800 p-3 rounded-lg max-w-xs break-words">
              <p>{message}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="p-4 bg-gray-900 w-full max-w-2xl rounded-t-lg">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            placeholder="Type your message..."
            className="flex-grow p-2 rounded-lg bg-gray-800 text-white focus:outline-none border border-gray-700 focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
                inputRef.current?.focus();
              }
            }}
          />
          <button
            onClick={() => {
              sendMessage();
              inputRef.current?.focus();
            }}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 font-bold"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
