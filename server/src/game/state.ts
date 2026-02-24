import db from "../db";

export type Player = {
  id: string;
  lat: number | null;
  lng: number | null;
};

export type Room = {
  players: Record<string, Player>;
};

export const rooms: Record<string, Room> = {};

export type GameState = {
  turn: number;
  currentPlayer: string | null;
  players: Record<string, Player>;
  properties: Record<string, any>;
};

export function createInitialState(): GameState {
  return {
    turn: 0,
    currentPlayer: null,
    players: {},
    properties: {}
  };
}

export function createGame(): { gameCode: string; state: GameState } {
  const gameCode = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  const state = createInitialState();

  db.prepare(`
    INSERT INTO games (game_code, state)
    VALUES (?, ?)
  `).run(gameCode, JSON.stringify(state));

  return { gameCode, state };
}

export function loadGame(gameCode: string): GameState | null {
  const row = db
    .prepare("SELECT state FROM games WHERE game_code = ?")
    .get(gameCode) as { state: string } | undefined;

  return row ? JSON.parse(row.state) : null;
}


export function saveGame(gameCode: string, state: GameState): void {
  db.prepare(`
    UPDATE games
    SET state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE game_code = ?
  `).run(JSON.stringify(state), gameCode);
}
