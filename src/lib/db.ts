import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// DATA_DIR override lets the desktop (Electron) build store data in the OS
// user-data folder instead of the app bundle, which is read-only when installed.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "hr_evaluator.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      required_skills TEXT NOT NULL DEFAULT '[]',
      preferred_skills TEXT NOT NULL DEFAULT '[]',
      min_experience REAL NOT NULL DEFAULT 0,
      education TEXT NOT NULL DEFAULT '[]',
      min_cgpa REAL,
      job_type TEXT NOT NULL DEFAULT 'Onsite',
      employment_type TEXT NOT NULL DEFAULT 'Full Time',
      location TEXT NOT NULL DEFAULT '',
      mandatory_keywords TEXT NOT NULL DEFAULT '[]',
      nice_keywords TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      ats_score REAL NOT NULL DEFAULT 0,
      parsed TEXT NOT NULL DEFAULT '{}',
      breakdown TEXT NOT NULL DEFAULT '{}',
      explanation TEXT NOT NULL DEFAULT '{}',
      parse_method TEXT NOT NULL DEFAULT 'rules',
      raw_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id);
    CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(job_id, ats_score DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}

export function deleteSetting(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToJob(row: any) {
  return {
    ...row,
    required_skills: JSON.parse(row.required_skills),
    preferred_skills: JSON.parse(row.preferred_skills),
    education: JSON.parse(row.education),
    mandatory_keywords: JSON.parse(row.mandatory_keywords),
    nice_keywords: JSON.parse(row.nice_keywords),
  };
}

export function rowToCandidate(row: any, includeRaw = false) {
  const c: any = {
    ...row,
    parsed: JSON.parse(row.parsed),
    breakdown: JSON.parse(row.breakdown),
    explanation: JSON.parse(row.explanation),
  };
  if (!includeRaw) delete c.raw_text;
  return c;
}
