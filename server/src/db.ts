// src/db.ts
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "games.db");

const db = new Database(dbPath);

// Enable foreign keys (good practice)
db.pragma("foreign_keys = ON");

// Create games table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    game_code TEXT PRIMARY KEY,
    players TEXT NOT NULL,
    paths TEXT NOT NULL,
    map_ownership TEXT,
    money TEXT,
    turn_order TEXT,
    current_turn INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure compatibility with older DB schema: add missing columns if needed
try {
  const existingCols = db.prepare("PRAGMA table_info(games)").all() as Array<{ name: string }>;
  const colNames = new Set(existingCols.map(c => c.name));

  const ensureColumn = (colDef: string, colName: string) => {
    if (!colNames.has(colName)) {
      try {
        db.exec(`ALTER TABLE games ADD COLUMN ${colDef}`);
        console.log(`Added missing column '${colName}' to games table`);
      } catch (err) {
        console.error(`Failed to add column ${colName}:`, err);
      }
    }
  };

  ensureColumn("players TEXT NOT NULL DEFAULT '[]'", "players");
  ensureColumn("paths TEXT NOT NULL DEFAULT '{}'", "paths");
  ensureColumn("map_ownership TEXT", "map_ownership");
  ensureColumn("money TEXT", "money");
  ensureColumn("turn_order TEXT", "turn_order");
  ensureColumn("current_turn INTEGER DEFAULT 0", "current_turn");
  ensureColumn("created_at DATETIME DEFAULT CURRENT_TIMESTAMP", "created_at");
  ensureColumn("updated_at DATETIME DEFAULT CURRENT_TIMESTAMP", "updated_at");
} catch (err) {
  console.error("Failed to migrate games table schema:", err);
}

export default db;
