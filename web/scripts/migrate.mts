import { databasePath, getDb } from "../lib/db/index.ts";

// 建表（或补齐新表）。可重复执行：SQL 全部是 CREATE ... IF NOT EXISTS。
const db = getDb();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as Array<{ name: string }>;

console.log(`[db] ${databasePath()}`);
console.log(`[db] tables: ${tables.map((row) => row.name).join(", ")}`);
db.close();
