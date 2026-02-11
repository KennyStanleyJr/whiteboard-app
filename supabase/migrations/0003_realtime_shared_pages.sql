-- Enable Realtime for shared_pages so clients can subscribe to live updates.
-- Run this in the Supabase SQL Editor if you use live updates.
-- Safe to run multiple times (skips if already in publication).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shared_pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared_pages;
  END IF;
END $$;
