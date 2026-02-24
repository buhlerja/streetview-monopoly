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

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

//initialize database
db.prepare(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_code TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

//Routes
app.use("/game", gameRoutes);

// //Start Server
// httpServer.listen(PORT, () => {
//   console.log(`Server listening on http://localhost:${PORT}`);
// });