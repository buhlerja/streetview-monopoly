import { Router } from "express";
import { createGame, loadGame, saveGame } from "../game/state";
import db from "../db";

const router = Router();

// Create a new game
router.post("/", (req, res) => {
  const { gameCode, state } = createGame();
  res.status(201).json({ gameCode, state });
});

// Load existing game state by code
router.get("/:gameCode", (req, res) => {
  const { gameCode } = req.params;
  const state = loadGame(gameCode);
  
  if (!state) {
    return res.status(404).json({ error: "Game not found" });
  }
  
  res.json({ gameCode, state });
});

// Get game persistence data from database (for testing)
router.get("/:gameCode/persisted", (req, res) => {
  const { gameCode } = req.params;
  
  try {
    const row = db.prepare("SELECT * FROM games WHERE game_code = ?").get(gameCode) as any;
    
    if (!row) {
      return res.status(404).json({ error: "Game not persisted in database" });
    }
    
    res.json({
      gameCode: row.game_code,
      players: JSON.parse(row.players),
      paths: JSON.parse(row.paths),
      mapOwnership: row.map_ownership ? JSON.parse(row.map_ownership) : {},
      money: row.money ? JSON.parse(row.money) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load persisted game" });
  }
});

// Save/update game state
router.put("/:gameCode", (req, res) => {
  const { gameCode } = req.params;
  const { state } = req.body;
  
  if (!state) {
    return res.status(400).json({ error: "State is required" });
  }
  
  try {
    saveGame(gameCode, state);
    res.json({ gameCode, state });
  } catch (error) {
    res.status(500).json({ error: "Failed to save game" });
  }
});

export default router;
