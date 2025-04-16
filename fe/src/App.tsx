import { useEffect, useRef, useState } from "react";

function App() {
  const [messages, setMessages] = useState(["hi there"]);
  const wsRef = useRef<WebSocket | undefined>(null);
  const inputRef = useRef<HTMLInputElement>(null);

 
 
 const sendMessage = () => {
  const message = inputRef.current?.value;
  if(message && wsRef.current) {
    wsRef.current.send(JSON.stringify({
      type:"chat",
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
    const ws = new WebSocket("ws://localhost:8080");
    ws.onmessage = (event) => {
      // @ts-ignore
      setMessages(m => [...m, event.data]);
    }
    wsRef.current = ws;

    ws.onopen = () => {
      const message = {
        type: "join",
        payload: {
          roomId: "red"
        }
      };
      ws.send(JSON.stringify(message));
    }
    return () => {
      ws.close();
    }
  }, []);

  return (
    <>
      <div className="flex flex-col bg-black text-white h-screen w-screen items-center justify-center">
        <header className="p-4  text-center  font-bold text-4xl">
          Chat App
        </header>

        {/* Chat Area */}
        <div className="flex-grow p-4 overflow-y-auto w-md">
          <div className="flex flex-col gap-4">

            {/* incoming */}
            {messages.map((message, index) => (
              <div key={index} className="self-start bg-gray-800 p-3 rounded-lg max-w-xs">
                <p>{message}</p>
              </div>
            ))}

            {/*             
            <div className="self-end bg-blue-600 p-3 rounded-lg max-w-xs">
              <p>I'm good, thanks! How about you?</p>
            </div> */}

          </div>
        </div>

        <footer className="p-4 bg-gray-900 rounded-lg w-md">
          <div className="flex items-center gap-2 ">
            <input
              ref={inputRef}
              id="message"
              placeholder="Type your message..."
              className="flex-grow  p-2  rounded-lg bg-gray-800 text-white focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                  if(inputRef.current) inputRef.current.focus();
                }
              }}
            />
            <button onClick={() => {sendMessage(); if(inputRef.current) inputRef.current.focus();
            }} 
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
              Send
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

export default App;
