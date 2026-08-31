-- StreamArena schema (SQLite via Node's built-in node:sqlite for the
-- prototype). Every column here maps 1:1 onto a Postgres table for
-- production — see README.md "Scaling to production".

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  username            TEXT UNIQUE NOT NULL,
  display_name        TEXT NOT NULL,
  password_hash       TEXT NOT NULL,
  avatar_color        TEXT NOT NULL DEFAULT '#7c3aed',
  email               TEXT,
  full_access_granted INTEGER NOT NULL DEFAULT 0,
  full_access_at      TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT UNIQUE NOT NULL REFERENCES users(id),
  balance    INTEGER NOT NULL DEFAULT 500,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  meta       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '',
  streamer_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  is_live     INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT,
  ended_at    TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS gift_events (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL REFERENCES channels(id),
  sender_id   TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  gift_id     TEXT NOT NULL,
  cost        INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS follows (
  id          TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id),
  followed_id TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(follower_id, followed_id)
);

CREATE TABLE IF NOT EXISTS arena_results (
  id           TEXT PRIMARY KEY,
  round_number INTEGER NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id),
  wager        INTEGER NOT NULL DEFAULT 0,
  final_score  INTEGER NOT NULL DEFAULT 0,
  placement    INTEGER NOT NULL DEFAULT 0,
  payout       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------------
-- AI-agent-managed support desk (email + live chat + tech support all flow
-- through one ticket model, whichever channel they arrive on).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS support_tickets (
  id                TEXT PRIMARY KEY,
  channel           TEXT NOT NULL,              -- 'email' | 'chat'
  user_id           TEXT REFERENCES users(id),  -- null for an unauthenticated/guest requester
  requester_email   TEXT,                       -- for email-channel tickets (or a guest-supplied email)
  requester_name    TEXT,
  subject           TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'general', -- see support/triage.ts CATEGORIES
  status             TEXT NOT NULL DEFAULT 'open',     -- 'open' | 'escalated' | 'resolved'
  requires_human    INTEGER NOT NULL DEFAULT 0,
  escalation_reason TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS support_messages (
  id           TEXT PRIMARY KEY,
  ticket_id    TEXT NOT NULL REFERENCES support_tickets(id),
  sender       TEXT NOT NULL,   -- 'requester' | 'ai_agent' | 'human_agent' | 'system'
  body         TEXT NOT NULL,
  -- delivery/receipt tracking, mirroring what a real ESP webhook would give us
  received_at  TEXT,            -- when we received it (requester messages)
  sent_at      TEXT,            -- when we dispatched it (agent messages)
  provider_ref TEXT,            -- EmailProvider/AI provider ref for audit
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
