-- Trip Planner — Neon (PostgreSQL) schema
-- Run this once in the Neon SQL Editor before first deployment.

CREATE TABLE IF NOT EXISTS app_data (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT    NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS share_tokens (
  token      TEXT        PRIMARY KEY,
  trip_id    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the singleton state row so PUT can always use UPDATE.
INSERT INTO app_data (id, data)
VALUES (1, '{"trips":[],"settings":{"theme":"beach","currency":"USD"}}')
ON CONFLICT DO NOTHING;
