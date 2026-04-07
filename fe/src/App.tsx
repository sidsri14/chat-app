import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  type: "chat";
  username: string;
  message: string;
  timestamp: number;
};

type SystemMessage = {
  type: "system";
  message: string;
};

type DisplayMessage = ChatMessage | SystemMessage;

function App() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.DEV
      ? "ws://localhost:8080"
      : `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "history") {
          setMessages(
            parsed.payload.messages.map((m: Omit<ChatMessage, "type">) => ({
              type: "chat" as const,
              ...m,
            }))
          );
        } else if (parsed.type === "chat") {
          setMessages((prev) => [
            ...prev,
            { type: "chat" as const, ...parsed.payload },
          ]);
        } else if (parsed.type === "system") {
          setMessages((prev) => [
            ...prev,
            { type: "system" as const, message: parsed.payload.message },
          ]);
        }
      } catch {
        // ignore malformed messages
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinRoom = () => {
    if (!username.trim() || !roomId.trim() || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "join",
        payload: { roomId: roomId.trim(), username: username.trim() },
      })
    );
    setJoined(true);
  };

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({ type: "chat", payload: { message: input.trim() } })
    );
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      joined ? sendMessage() : joinRoom();
    }
  };

  if (!joined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-950 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 flex flex-col gap-4">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Chat App</h1>
            <p className="mt-1 text-sm text-gray-400">
              Enter a room to start chatting
            </p>
          </div>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Your name"
            autoFocus
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Room ID"
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />

          <button
            onClick={joinRoom}
            disabled={!username.trim() || !roomId.trim()}
            className="rounded-lg bg-blue-600 py-3 text-sm font-semibold transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join Room
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500"}`}
            />
            {connected ? "Connected" : "Connecting..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div>
          <h1 className="font-bold text-base"># {roomId}</h1>
          <p className="text-xs text-gray-400">You are {username}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          />
          {connected ? "Connected" : "Disconnected"}
        </div>
      </header>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-600 mt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg, i) => {
          if (msg.type === "system") {
            return (
              <div key={i} className="my-1 text-center text-xs text-gray-500">
                {msg.message}
              </div>
            );
          }

          const isOwn = msg.username === username;
          return (
            <div
              key={i}
              className={`flex flex-col gap-1 ${isOwn ? "items-end self-end" : "items-start self-start"} max-w-[70%]`}
            >
              <span className="px-1 text-xs text-gray-400">
                {isOwn ? "You" : msg.username}
              </span>
              <div
                className={`break-words rounded-2xl px-4 py-2 text-sm ${
                  isOwn
                    ? "rounded-br-sm bg-blue-600"
                    : "rounded-bl-sm bg-gray-800"
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <footer className="border-t border-gray-800 bg-gray-900 px-4 py-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            autoFocus
            className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
