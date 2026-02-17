import { useState, useEffect } from "react";
import "./App.css";
import { io, Socket } from "socket.io-client";
import Streetcrawl from "./streetcrawl";

let socket: Socket;

export default function App() {
  const [screen, setScreen] = useState<"menu" | "new" | "join" | "streetcrawl">(
    "menu"
  );

  const [gameCode, setGameCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [connected, setConnected] = useState(false);

  /* ---------------- Connect to server on app boot ---------------- */
  useEffect(() => {
    socket = io("http://localhost:3001");

    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    // Optional: listen for updates from the server
    socket.on("playerJoined", (data) => {
      console.log("A player joined your game:", data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  /* ---------------- New Game Screen ---------------- */
  if (screen === "new") {
    return (
      <div className="menu-screen">
        <h1>New Game</h1>

        <p>Your game code:</p>

        <div className="game-code">
          {gameCode}
        </div>

        <button 
          onClick={() => setScreen("streetcrawl")}
          disabled={!gameCode}
        >
          Start Game
        </button>

        <button onClick={() => setScreen("menu")}>
          Back
        </button>
      </div>
    );
  }

  /* ---------------- Join Game Screen ---------------- */
  if (screen === "join") {
    return (
      <div className="menu-screen">
        <h1>Join Game</h1>

        <input
          type="text"
          placeholder="Enter game code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />

        <button
          disabled={!joinCode}
          onClick={() => {
            // Ask server to join game
            socket.emit("joinGame", joinCode, (success: boolean, message?: string) => {
              if (success) {
                setGameCode(joinCode);
                setScreen("streetcrawl");
              } else {
                alert(message || "Could not join game");
              }
            });
          }}
        >
          Join
        </button>

        <button onClick={() => setScreen("menu")}>
          Back
        </button>
      </div>
    );
  }

  /* ---------------- Streetcrawl ---------------- */
  if (screen === "streetcrawl") {
    return (
      <Streetcrawl
        gameCode={gameCode}
        onExit={() => setScreen("menu")} 
      />
    );
  }

  /* ---------------- Main Menu ---------------- */
  return (
    <div className="menu-screen">
      <h1>StreetView Monopoly</h1>

      <div className="menu-buttons">
        <button
          onClick={() => {
            // Ask server to create a new game
            socket.emit("createGame", (code: string) => {
              setGameCode(code);
              setScreen("new");
            });
          }}
          disabled={!connected}
        >
          New Game
        </button>

        <button
          onClick={() => setScreen("join")}
          disabled={!connected}
        >
          Join Game
        </button>
      </div>
    </div>
  );
}

