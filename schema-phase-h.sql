-- Phase H: Preparation tab — Shopping List & To-Do List support.
-- Run this in the Neon SQL Editor BEFORE deploying the updated API.
-- Idempotent — safe to re-run.

ALTER TABLE packing_categories ADD COLUMN IF NOT EXISTS list_type TEXT NOT NULL DEFAULT 'packing';
