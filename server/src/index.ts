import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json()); // for JSON POSTs if needed

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173"
  }
});

interface LatLngPoint {
  lat: number;
  lng: number;
}

export type GamePaths = Record<string, LatLngPoint[]>;

// Keep track of active games and their players/paths in memory
interface Game {
  code: string;
  players: string[]; 
  paths: GamePaths; 
}

const games: Record<string, Game> = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Client wants to create a new game
  socket.on("createGame", (callback: (code: string) => void) => {
    const code = generateGameCode();
    games[code] = { code, players: [socket.id], paths: {} };
    socket.join(code); // socket joins the room named by the code
    console.log(`Game created: ${code} by ${socket.id}`);

    callback(code); // send code back to client
  });

  // Client wants to join an existing game
  socket.on(
    "joinGame",
    (code: string, callback: (success: boolean, message?: string) => void) => {
      const game = games[code];
      if (!game) {
        callback(false, "Game not found");
        return;
      }

      if (game.players.length >= 2) {
        callback(false, "Game is full");
        return;
      }

      game.players.push(socket.id);
      socket.join(code);
      console.log(`${socket.id} joined game ${code}`);

      callback(true);
      // Optionally, notify everyone in the room that a new player joined
      io.to(code).emit("playerJoined", { playerId: socket.id });
    }
  );

  socket.on("updatePath", ({ gameCode, pathPoint }) => {
    if (!games[gameCode]) return;

    games[gameCode].paths ??= {};
    games[gameCode].paths[socket.id] ??= [];
    games[gameCode].paths[socket.id].push({
      lat: pathPoint.lat,
      lng: pathPoint.lng,
    });

    io.to(gameCode).emit(
      "gamePathsUpdate",
      games[gameCode].paths // Broadcast to room (gameCode)
    );
  });

  socket.on("leaveGameRoom", (gameCode: string) => {
    const game = games[gameCode];
    if (!game) return;

    // Remove player from socket room
    socket.leave(gameCode);

    // Remove player from game state
    if (game.players) {
      game.players = game.players.filter(
        player => player !== socket.id
      );
    }

    // Remove path data
    if (game.paths) {
      delete game.paths[socket.id];
    }

    // Notify remaining players
    io.to(gameCode).emit("gamePathsUpdate", game.paths);

    console.log(`Player ${socket.id} left game ${gameCode}`);
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Remove player from any games
    for (const code in games) {
      const game = games[code];
      game.players = game.players.filter((id) => id !== socket.id);
      // If no players left, delete the game
      if (game.players.length === 0) {
        delete games[code];
        console.log(`Game ${code} deleted (no players left)`);
      }
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Helper to generate 6-character game codes
function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}