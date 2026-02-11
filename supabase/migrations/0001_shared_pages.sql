-- Shared pages table for "Share page" feature.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor) if using the share feature.
-- Enable RLS and allow anonymous read/write for shared pages (no auth required).
CREATE TABLE IF NOT EXISTS shared_pages (
  id TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shared_pages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (create links)
CREATE POLICY "Allow insert" ON shared_pages
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read by id (open shared links)
CREATE POLICY "Allow select by id" ON shared_pages
  FOR SELECT USING (true);

-- Allow anyone to update (sync edits to shared pages)
CREATE POLICY "Allow update" ON shared_pages
  FOR UPDATE USING (true)
  WITH CHECK (true);
