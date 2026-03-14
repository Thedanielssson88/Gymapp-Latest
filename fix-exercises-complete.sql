-- Complete fix for exercises table - add user_id and is_public columns
-- Run this in Supabase SQL Editor

-- 1. Add missing columns to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- 2. Ensure RLS is enabled
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies
DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

-- 4. Create new policies that support both public and private exercises
CREATE POLICY "Users can read public or own exercises"
  ON exercises FOR SELECT
  USING (is_public = true OR auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own exercises"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text AND is_public = false);

CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE
  USING (auth.uid()::text = user_id::text AND is_public = false)
  WITH CHECK (auth.uid()::text = user_id::text AND is_public = false);

CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE
  USING (auth.uid()::text = user_id::text AND is_public = false);

-- Done! 🎉
-- Now you can import base exercises with is_public = true
