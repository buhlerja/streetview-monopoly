import { Router } from "express";
import { createGame, loadGame, saveGame } from "../game/state";

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
