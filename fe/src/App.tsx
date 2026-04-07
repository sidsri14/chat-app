import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactMarkdown from 'react-markdown';


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
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [roomUsers, setRoomUsers] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    // If already connecting or connected, don't start another
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.DEV
      ? "ws://127.0.0.1:8080"
      : `${protocol}//${window.location.host}`;

    console.log(`Attempting to connect to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to server successfully");
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      
      // Re-join if we were already in a room
      if (joined && roomId && username) {
        ws.send(JSON.stringify({
          type: "join",
          payload: { roomId: roomId.trim(), username: username.trim() },
        }));
      }
    };

    ws.onclose = () => {
      console.log("Connection closed");
      setConnected(false);
      
      // Exponential backoff
      const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
      reconnectAttemptsRef.current += 1;
      
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, timeout);
    };

    ws.onerror = (err) => {
      console.error("WebSocket transport error:", err);
    };

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
        } else if (parsed.type === "typing") {
          const { username: typingUser, isTyping } = parsed.payload;
          setTypingUsers((prev) => {
            const next = new Set(prev);
            if (isTyping) next.add(typingUser);
            else next.delete(typingUser);
            return next;
          });
        } else if (parsed.type === "users_list") {
          setRoomUsers(parsed.payload.users);
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, [joined, roomId, username]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnection on cleanup
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const joinRoom = () => {
    if (!username.trim() || !roomId.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: "join",
        payload: { roomId: roomId.trim(), username: username.trim() },
      })
    );
    setJoined(true);
  };

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: "chat", payload: { message: input.trim() } })
    );
    setInput("");
    
    // Stop typing immediately on send
    wsRef.current.send(
      JSON.stringify({ type: "typing", payload: { isTyping: false } })
    );
  };

  const handeInputChange = (val: string) => {
    setInput(val);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Send typing notification
    wsRef.current.send(
      JSON.stringify({ type: "typing", payload: { isTyping: true } })
    );

    // Stop typing indicator after 2 seconds of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      wsRef.current?.send(
        JSON.stringify({ type: "typing", payload: { isTyping: false } })
      );
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      joined ? sendMessage() : joinRoom();
    }
  };

  const otherTypingUsers = useMemo(() => {
    const list = Array.from(typingUsers).filter(u => u !== username);
    if (list.length === 0) return "";
    if (list.length === 1) return `${list[0]} is typing...`;
    return `${list.join(", ")} are typing...`;
  }, [typingUsers, username]);

  if (!joined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black selection:bg-blue-500/30">
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-600/20 blur-[120px] animate-pulse" />
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-600/20 blur-[120px] animate-pulse delay-700" />
        </div>

        <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-2xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 mb-4 border border-blue-500/20">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Connect</h1>
            <p className="text-gray-400">Join a secure room to start chatting</p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Your Alias</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="How should others see you?"
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 ml-1">Room Key</label>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter room ID"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>

            <button
              onClick={joinRoom}
              disabled={!username.trim() || !roomId.trim() || !connected}
              className="mt-2 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white transition-all hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-blue-600/20"
            >
              Enter Room
            </button>

            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={`relative flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                {connected ? "Server Ready" : "Establishing Link..."}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-black text-white selection:bg-blue-500/30">
      <div className="flex-1 flex flex-col min-w-0">
      {/* Dynamic Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/40 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/20">
              <span className="font-bold">#</span>
           </div>
           <div>
            <h1 className="text-lg font-bold tracking-tight">{roomId}</h1>
            <p className="text-xs text-gray-500">Connected as <span className="text-blue-400 font-semibold">{username}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
               {connected ? "Encrypted" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 custom-scrollbar pattern-bg">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-20 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
            <p className="text-lg font-medium">Broadcast something to the room</p>
          </div>
        )}
        
        {messages.map((msg, i) => {
          if (msg.type === "system") {
            return (
              <div key={i} className="flex justify-center">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  {msg.message}
                </span>
              </div>
            );
          }

          const isOwn = msg.username === username;
          return (
            <div
              key={i}
              className={`flex w-full group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex flex-col max-w-[80%] md:max-w-[60%] ${isOwn ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                   <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {isOwn ? "You" : msg.username}
                  </span>
                  <span className="text-[9px] text-gray-700 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`relative px-4 py-3 text-sm leading-relaxed shadow-lg ${
                    isOwn
                      ? "bg-blue-600 text-white rounded-2xl rounded-tr-none shadow-blue-600/10 border border-blue-500/20"
                      : "bg-white/5 text-gray-200 rounded-2xl rounded-tl-none border border-white/10"
                  }`}
                >
                  <div className="text-sm break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_strong]:text-blue-100">
                    <ReactMarkdown>
                      {msg.message || ""}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {otherTypingUsers && (
           <div className="flex justify-start animate-pulse">
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest italic ml-1">
              {otherTypingUsers}
            </span>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Console */}
      <footer className="relative border-t border-white/5 bg-black/40 p-6 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl gap-3">
          <div className="relative flex-1">
            <input
              value={input}
              onChange={(e) => handeInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Inject message..."
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="group flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white transition-all hover:bg-blue-500 active:scale-90 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </footer>
      </div>

      {/* Online Users Sidebar */}
      <div className="hidden md:flex w-64 border-l border-white/10 bg-black/40 backdrop-blur-xl flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Online — {roomUsers.length}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {roomUsers.map((u) => (
            <div key={u} className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${u === username ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'}`} />
              <span className={`text-sm tracking-wide ${u === username ? 'font-bold text-white' : 'text-gray-300'}`}>{u} {u === username && <span className="text-gray-500 text-xs font-normal ml-1">(You)</span>}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
