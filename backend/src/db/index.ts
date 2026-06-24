import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Database } from "../schema/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

export function initDb(): void {
  const dbPath = path.join(__dirname, "db.json");
  const dbText = fs.readFileSync(dbPath, "utf-8");
  db = JSON.parse(dbText) as Database;
}

export function getDb(): Database {
  if (db === null) {
    throw new Error(
      "You must call initDb() first before getting the database!",
    );
  }
  return db;
}
