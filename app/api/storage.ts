import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "inputs.sqlite");

let db: Database.Database | null = null;

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function initDb(): Database.Database {
  if (db) return db;
  // ensure directory exists (best-effort sync after ensuring async dir exists)
  void ensureDataDir();
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT,
      received TEXT,
      result TEXT,
      ts TEXT
    );
  `);
  return db;
}

export function saveInput(obj: any): number {
  try {
    const d = initDb();
    const stmt = d.prepare(
      `INSERT INTO inputs (route, received, result, ts) VALUES (?, ?, ?, ?)`
    );
    const info = stmt.run(
      obj.route ?? null,
      JSON.stringify(obj.received ?? null),
      JSON.stringify(obj.result ?? null),
      obj.ts ?? new Date().toISOString()
    );
    // better-sqlite3 returns lastInsertRowid (number)
    // cast to number for callers
    // @ts-ignore - better-sqlite3 types may vary
    return Number(info.lastInsertRowid ?? info.lastInsertRowID ?? -1);
  } catch (e) {
    console.error("saveInput error:", e);
    return -1;
  }
}

function tryParse(s: any) {
  if (s == null) return null;
  try {
    return JSON.parse(s as string);
  } catch (e) {
    return s;
  }
}

export function readInputs(limit?: number): any[] {
  try {
    const d = initDb();
    const q = limit ? d.prepare("SELECT * FROM inputs ORDER BY id DESC LIMIT ?") : d.prepare("SELECT * FROM inputs ORDER BY id DESC");
    const rows = limit ? q.all(limit) : q.all();
    return rows.map((r: any) => ({
      id: r.id,
      route: r.route,
      received: tryParse(r.received),
      result: tryParse(r.result),
      ts: r.ts,
    }));
  } catch (e) {
    console.error("readInputs error:", e);
    return [];
  }
}

export default { saveInput, readInputs };
