-- Fix zones table - add user_id column if missing
-- Run this in Supabase SQL Editor

-- Add user_id column if it doesn't exist
ALTER TABLE zones ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Ensure RLS is enabled
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own zones" ON zones;
DROP POLICY IF EXISTS "Users can insert own zones" ON zones;
DROP POLICY IF EXISTS "Users can update own zones" ON zones;
DROP POLICY IF EXISTS "Users can delete own zones" ON zones;

-- Create new policies
CREATE POLICY "Users can read own zones"
  ON zones FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own zones"
  ON zones FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own zones"
  ON zones FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own zones"
  ON zones FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Done! 🎉
