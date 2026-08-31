import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../lib/env.js';

// A single shared SQLite connection for the process (SQLite is
// single-writer anyway, so this matches how it's meant to be used). In
// production this file swaps for a `pg` Pool against Postgres — the repo.ts
// call sites above it don't change, only what's inside them.
//
// We use Node's built-in `node:sqlite` (stable from Node 22.5+) rather than
// a native addon like better-sqlite3 specifically so `npm install` never
// needs to compile or download a native binary — it Just Works anywhere
// Node itself runs.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDbPath(url: string): string {
  if (url.startsWith('file:')) return url.slice('file:'.length);
  return url;
}

const dbPath = resolveDbPath(env.databaseUrl);
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

export const db = new DatabaseSync(resolvedPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

export function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
