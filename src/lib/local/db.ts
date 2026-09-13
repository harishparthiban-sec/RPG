// ─── Local SQLite persistence (zero-config mode) ────────────────────────────
// Mirrors the Supabase schema so the app runs with `npm install && npm run dev`
// and no external services. Data survives restarts; this is NOT localStorage.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.LIFE_RPG_DATA_DIR ?? path.join(process.cwd(), ".data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "liferpg.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function migrate(): void {
  db.exec(`
    create table if not exists users (
      id            text primary key,
      email         text not null unique,
      username      text not null,
      password_hash text not null,
      created_at    text not null
    );

    create table if not exists sessions (
      token       text primary key,
      user_id     text not null references users(id) on delete cascade,
      expires_at  text not null
    );

    create table if not exists profiles (
      id           text primary key references users(id) on delete cascade,
      username     text not null,
      level        integer not null default 1,
      xp           integer not null default 0,
      gold         integer not null default 50,
      total_xp     integer not null default 0,
      title        text not null default 'Wanderer',
      avatar_theme text not null default 'default',
      created_at   text not null
    );

    create table if not exists quests (
      id           text primary key,
      user_id      text not null references users(id) on delete cascade,
      title        text not null,
      description  text,
      category     text not null,
      difficulty   text not null,
      xp_reward    integer not null,
      gold_reward  integer not null,
      completed    integer not null default 0,
      completed_at text,
      due_date     text,
      created_at   text not null
    );
    create index if not exists quests_user_idx on quests(user_id, created_at desc);

    create table if not exists attributes (
      user_id text not null references users(id) on delete cascade,
      key     text not null,
      xp      integer not null default 0,
      level   integer not null default 0,
      primary key (user_id, key)
    );

    create table if not exists streaks (
      user_id          text primary key references users(id) on delete cascade,
      current          integer not null default 0,
      best             integer not null default 0,
      last_active_date text
    );

    create table if not exists inventory (
      id          text primary key,
      user_id     text not null references users(id) on delete cascade,
      item_key    text not null,
      equipped    integer not null default 0,
      acquired_at text not null,
      unique (user_id, item_key)
    );

    create table if not exists transactions (
      id         text primary key,
      user_id    text not null references users(id) on delete cascade,
      kind       text not null,
      amount     integer not null,
      reason     text not null,
      created_at text not null
    );

    create table if not exists meta (
      key   text primary key,
      value text not null
    );
  `);
}

migrate();

export default db;

// ─── Manual transaction helper (node:sqlite has no db.transaction wrapper) ──

export class Txn {
  private committed = false;
  private rolledBack = false;

  constructor() {
    db.exec("BEGIN");
  }

  prepare(sql: string) {
    return db.prepare(sql);
  }

  commit() {
    if (this.committed || this.rolledBack) return;
    db.exec("COMMIT");
    this.committed = true;
  }

  rollback() {
    if (this.committed || this.rolledBack) return;
    try {
      db.exec("ROLLBACK");
    } finally {
      this.rolledBack = true;
    }
  }
}

// ─── Small helpers shared by the local handlers ─────────────────────────────

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
