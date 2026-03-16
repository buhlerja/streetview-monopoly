import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

import db from "./db";
import gameRoutes from "./routes/game";

const app = express();
app.use(express.json());
app.use(cors());

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
  mapOwnership?: Record<string, string[]>;
  money?: Record<string, number>;
  turnOrder?: string[];
  currentTurn?: number;
}

const games: Record<string, Game> = {};

// Load games from database on startup
function loadGamesFromDatabase() {
  try {
    const rows = db.prepare("SELECT * FROM games").all() as any[];
    rows.forEach(row => {
      games[row.game_code] = {
        code: row.game_code,
        players: JSON.parse(row.players),
        paths: JSON.parse(row.paths),
        mapOwnership: row.map_ownership ? JSON.parse(row.map_ownership) : {},
        money: row.money ? JSON.parse(row.money) : {},
        turnOrder: row.turn_order ? JSON.parse(row.turn_order) : [],
        currentTurn: row.current_turn || 0,
      };
    });
    console.log(`Loaded ${rows.length} games from database`);
  } catch (error) {
    console.error("Failed to load games from database:", error);
  }
}

// Save game to database
function saveGameToDatabase(game: Game) {
  try {
    const stmt = db.prepare(`
      INSERT INTO games (game_code, players, paths, map_ownership, money, turn_order, current_turn, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(game_code) DO UPDATE SET
        players = excluded.players,
        paths = excluded.paths,
        map_ownership = excluded.map_ownership,
        money = excluded.money,
        turn_order = excluded.turn_order,
        current_turn = excluded.current_turn,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      game.code,
      JSON.stringify(game.players),
      JSON.stringify(game.paths),
      game.mapOwnership ? JSON.stringify(game.mapOwnership) : null,
      game.money ? JSON.stringify(game.money) : null,
      game.turnOrder ? JSON.stringify(game.turnOrder) : null,
      game.currentTurn ?? 0
    );
    console.log(`Game ${game.code} saved to database`);
  } catch (error) {
    console.error(`Failed to save game ${game.code}:`, error);
  }
}

// Load a specific game from database
function loadGameFromDatabase(code: string): Game | null {
  try {
    const row = db.prepare("SELECT * FROM games WHERE game_code = ?").get(code) as any;
    if (!row) return null;

    return {
      code: row.game_code,
      players: JSON.parse(row.players),
      paths: JSON.parse(row.paths),
      mapOwnership: row.map_ownership ? JSON.parse(row.map_ownership) : {},
      money: row.money ? JSON.parse(row.money) : {},
      turnOrder: row.turn_order ? JSON.parse(row.turn_order) : [],
      currentTurn: row.current_turn || 0,
    };
  } catch (error) {
    console.error(`Failed to load game ${code} from database:`, error);
    return null;
  }
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Client wants to create a new game
  socket.on("createGame", (callback: (code: string) => void) => {
    const code = generateGameCode();
    const newGame: Game = { code, players: [socket.id], paths: {}, mapOwnership: {}, money: {}, turnOrder: [socket.id], currentTurn: 0 };
    games[code] = newGame;
    saveGameToDatabase(newGame);
    socket.join(code);
    console.log(`Game created: ${code} by ${socket.id}`);
    callback(code);
  });

  // Client wants to join an existing game
  socket.on(
    "joinGame",
    (code: string, callback: (success: boolean, message?: string) => void) => {
      let game: Game | undefined = games[code];

      // If game not in memory, try loading from database
      if (!game) {
        const loadedGame = loadGameFromDatabase(code);
        if (loadedGame) {
          game = loadedGame;
          games[code] = game; // Add back to memory
        }
      }

      if (!game) {
        callback(false, "Game not found");
        return;
      }

      if (game.players.length >= 2) {//I think the game is 2-6 players, so we should change this to 6
        callback(false, "Game is full");
        return;
      }

      game.players.push(socket.id);
      game.turnOrder ??= [];
      game.turnOrder.push(socket.id);
      saveGameToDatabase(game); // Persist changes
      socket.join(code);
      console.log(`${socket.id} joined game ${code}`);

      callback(true);
      // Notify everyone in the room that a new player joined, send current game state
      io.to(code).emit("playerJoined", { playerId: socket.id });
      io.to(code).emit("gamePathsUpdate", game.paths);
    }
  );

  socket.on("endTurn",
    (code: string, callback: (success: boolean, message?: string) => void) => {
      let game: Game | undefined = games[code];
      if (!game) {
        const loadedGame = loadGameFromDatabase(code);
        if (!loadedGame) {
          callback?.(false, "Game not found");// If game not found, we can't end the turn, so we should callback with failure
          return;
        }
        game = loadedGame;
        games[code] = game;
      }
      game.turnOrder ??= [];
      game.currentTurn ??= 0;
      
      if (game.turnOrder.length === 0) {
        callback?.(false, "No players in game");
        return;// If there are no players, we can't end the turn, so we should callback with failure
      }
      const currentPlayerId = game.turnOrder[game.currentTurn];
      if (socket.id !== currentPlayerId) {
        callback?.(false, "Not your turn");
        return;// If it's not the player's turn, we can't end the turn, so we should callback with failure
      }
      game.currentTurn = (game.currentTurn + 1) % game.turnOrder.length;// Move to next player's turn
      saveGameToDatabase(game);
      io.to(code).emit("gameState", { code: game.code,
                                      players: game.players,
                                      currentTurn: game.currentTurn,
                                      currentPlayerId: game.turnOrder[game.currentTurn]?? null, });// Notify everyone in the room about the new turn
      callback?.(true);
    }
  );


  socket.on("updatePath", ({gameCode,pathPoint})=>{
    let game: Game | undefined = games[gameCode];
    if (!game) {
      const loadedGame = loadGameFromDatabase(gameCode);
      if (!loadedGame)return;
      game = loadedGame;
      games[gameCode] = game;
    }
    game.players ??= [];
    game.currentTurn ??= 0; 
    const currentPlayerId = game.turnOrder ![game.currentTurn];
    if (socket.id !== currentPlayerId) {
      return;// If it's not the player's turn, we shouldn't update paths
    }   
    game.paths ??= {};
    game.paths[socket.id] ??= [];
    game.paths[socket.id].push({
      lat: pathPoint.lat,
      lng: pathPoint.lng,
    });

    saveGameToDatabase(game);
    io.to(gameCode).emit("gamePathsUpdate", game.paths);
  });

  socket.on("leaveGameRoom", (gameCode: string) => {
    let game = games[gameCode];
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

    saveGameToDatabase(game); // Persist removal
    io.to(gameCode).emit("gamePathsUpdate", game.paths);

    console.log(`Player ${socket.id} left game ${gameCode}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = 3001;

// Load games from database on startup
loadGamesFromDatabase();

// Routes
app.use("/game", gameRoutes);

// Start Server
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Helper to generate 6-character game codes
function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
