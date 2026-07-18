import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { loadSecrets, projectPath } from "../config";

export type JobStatus = "open" | "closed";

export interface JobRow {
  id: number;
  company: string;
  title: string;
  location: string;
  url: string;
  first_seen: string; // ISO datetime
  last_checked: string; // ISO datetime
  status: JobStatus;
  hash: string;
  is_2027: number; // 0 | 1
  miss_count: number;
  closed_at: string | null;
}

let db: Database.Database | null = null;

export function getDb(dbPathOverride?: string): Database.Database {
  if (db) return db;
  const secrets = loadSecrets();
  const raw = dbPathOverride || secrets.databasePath;
  const dbPath = path.isAbsolute(raw) ? raw : projectPath(raw);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL UNIQUE,
      first_seen TEXT NOT NULL,
      last_checked TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      hash TEXT NOT NULL,
      is_2027 INTEGER NOT NULL DEFAULT 0,
      miss_count INTEGER NOT NULL DEFAULT 0,
      closed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  `);
  return db;
}

/** For tests: use an isolated database instance. */
export function openTestDb(): Database.Database {
  const testDb = new Database(":memory:");
  testDb.exec(`
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL UNIQUE,
      first_seen TEXT NOT NULL,
      last_checked TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      hash TEXT NOT NULL,
      is_2027 INTEGER NOT NULL DEFAULT 0,
      miss_count INTEGER NOT NULL DEFAULT 0,
      closed_at TEXT
    );
  `);
  return testDb;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
