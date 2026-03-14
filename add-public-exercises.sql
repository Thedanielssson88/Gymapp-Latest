-- Add support for public base exercises that all users can see
-- Run this in Supabase SQL Editor

-- 1. Add is_public column to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

-- 3. New policy: Users can read public exercises OR their own exercises
CREATE POLICY "Users can read public or own exercises"
  ON exercises FOR SELECT
  USING (is_public = true OR auth.uid()::text = user_id::text);

-- 4. Users can only insert their own exercises (not public ones)
CREATE POLICY "Users can insert own exercises"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text AND is_public = false);

-- 5. Users can only update their own exercises (not public ones)
CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE
  USING (auth.uid()::text = user_id::text AND is_public = false)
  WITH CHECK (auth.uid()::text = user_id::text AND is_public = false);

-- 6. Users can only delete their own exercises (not public ones)
CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE
  USING (auth.uid()::text = user_id::text AND is_public = false);

-- Done! 🎉
-- Now you need to import base exercises with is_public = true
