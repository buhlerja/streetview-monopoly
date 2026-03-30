import { useState, useEffect, useRef } from "react";
import "./App.css";
import { io, Socket } from "socket.io-client";
import Streetcrawl from "./streetcrawl";
import { saveGameCode, loadGameCode, clearGameCode } from "./storage";

//let socket: Socket;

export default function App() {
  const [screen, setScreen] = useState<"menu" | "new" | "join" | "streetcrawl">(
    "menu"
  );
  const socketRef = useRef<Socket | null>(null);
  const [gameCode, setGameCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [savedGameCode, setSavedGameCode] = useState<string | null>(null);

  /* ---------------- Connect to server on app boot ---------------- */
  useEffect(() => {
    socketRef.current = io("http://localhost:3001");

    const socket = socketRef.current; // grab the actual socket

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    const handlePlayerJoined = (data: any) => {
      console.log("A player joined your game:", data);
    };

    socket.on("playerJoined", handlePlayerJoined); // use socket

    return () => {
      socket.off("playerJoined", handlePlayerJoined); // use socket
      socket.disconnect(); // use socket
    };
  }, []);

  /* ---------------- Load saved game on mount ---------------- */
  useEffect(() => {
    const saved = loadGameCode();
    setSavedGameCode(saved);
  }, []);

  /* ---------------- New Game Screen ---------------- */
  if (screen === "new") {
    return (
      <div className="menu-screen">
        <h1>New Game Created</h1>

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
          disabled={!joinCode || !socketRef.current}
          onClick={() => {
            const socket = socketRef.current;
            if (!socket) return;

            socket.emit(
              "joinGame",
              joinCode,
              (success: boolean, message?: string) => {
                if (success) {
                  setGameCode(joinCode);
                  saveGameCode(joinCode);
                  setScreen("streetcrawl");
                } else {
                  alert(message || "Could not join game");
                }
              }
            );
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
        socket={socketRef.current}
        onExit={() => setScreen("menu")}
      />
    );
  }

  /* ---------------- Main Menu ---------------- */
  return (
    <div className="menu-screen">
      <h1>StreetView Monopoly</h1>

      <div className="menu-buttons">
        {savedGameCode && (
          <>
            <button
              onClick={() => {
                setGameCode(savedGameCode);
                setScreen("streetcrawl");
              }}
            >
              Resume Game ({savedGameCode})
            </button>

            <button
              onClick={() => {
                clearGameCode();
                setSavedGameCode(null);
              }}
            >
              Start Fresh
            </button>
          </>
        )}

        <button
          onClick={() => {
            const socket = socketRef.current;
            if (!socket) return;

            socket.emit("createGame", (code: string) => {
              setGameCode(code);
              saveGameCode(code);
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

