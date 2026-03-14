-- Add lastUpdated column to exercises table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- Add both camelCase and snake_case versions
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "lastUpdated" TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS last_updated TEXT;

-- Done! 🎉
-- Exercises will now track when they were last updated
