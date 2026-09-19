import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { defaults, initialGallery, initialServices } from './content.js';

export function createStore(directory = process.env.DATA_DIR || '.data') {
  const dir = resolve(directory);
  mkdirSync(join(dir, 'uploads'), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, 'site.sqlite'));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, collection TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT UNIQUE NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes INTEGER NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
  `);
  function list(collection) {
    return db.prepare('SELECT * FROM entries WHERE collection=?').all(collection).map(row => ({ ...JSON.parse(row.data), id: row.id, revision: row.revision, created: row.created, updated: row.updated })).sort((a, b) => a.order - b.order || a.created.localeCompare(b.created));
  }
  function settings() {
    const row = db.prepare('SELECT * FROM settings WHERE id=1').get();
    return { ...JSON.parse(row.data), revision: row.revision };
  }
  function insert(collection, data) {
    const id = randomUUID(); const now = new Date().toISOString();
    db.prepare('INSERT INTO entries (id,collection,data,created,updated) VALUES (?,?,?,?,?)').run(id, collection, JSON.stringify(data), now, now);
    return list(collection).find(item => item.id === id);
  }
  if (!db.prepare('SELECT id FROM settings WHERE id=1').get()) {
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO settings (id,data) VALUES (1,?)').run(JSON.stringify(defaults));
      initialServices.forEach(item => insert('services', item));
      initialGallery.forEach(item => insert('gallery', item));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const tokenFile = join(dir, 'setup-token');
  if (!db.prepare('SELECT id FROM users LIMIT 1').get() && !existsSync(tokenFile)) {
    writeFileSync(tokenFile, randomBytes(24).toString('hex'), { mode: 0o600 });
  }
  return { dir, db, list, settings, insert, tokenFile, setupToken: () => existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '' };
}
