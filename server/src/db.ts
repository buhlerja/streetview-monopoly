// src/db.ts
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "games.db");

const db = new Database(dbPath);

// Enable foreign keys (good practice)
db.pragma("foreign_keys = ON");

export default db;
