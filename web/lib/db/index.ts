import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { SCHEMA_SQL } from "./schema.ts";

// One connection per process. Next's dev server re-evaluates modules on every edit, so the
// handle lives on globalThis; without that, each HMR pass would leak another open file.
type GlobalWithDb = typeof globalThis & { __openwar3Db?: DatabaseSync };

export function databasePath(): string {
  const configured = process.env.DATABASE_PATH || "./data/openwar3.sqlite";
  return isAbsolute(configured) ? configured : join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function open(): DatabaseSync {
  const path = databasePath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec("PRAGMA busy_timeout=5000;");
  db.exec(SCHEMA_SQL);
  // `maps.category` arrived after the first databases existed; CREATE TABLE IF NOT EXISTS does
  // not add a column to a table that is already there, so bring an old file forward here.
  const columns = db.prepare("PRAGMA table_info(maps)").all() as unknown as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "category")) {
    db.exec("ALTER TABLE maps ADD COLUMN category TEXT NOT NULL DEFAULT 'other'");
  }
  return db;
}

export function getDb(): DatabaseSync {
  const g = globalThis as GlobalWithDb;
  if (!g.__openwar3Db) g.__openwar3Db = open();
  return g.__openwar3Db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
