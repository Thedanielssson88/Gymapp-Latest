-- Add admin role support
-- Run this in Supabase SQL Editor

-- 1. Add is_admin column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Make your account admin (replace with your actual user ID)
-- First, find your user ID by running: SELECT auth.uid();
-- Then update this line with your actual UUID:
UPDATE user_profiles
SET is_admin = true
WHERE id = (SELECT auth.uid()::text);

-- 3. Update exercises policies to allow admins to manage public exercises
DROP POLICY IF EXISTS "Users can read public or own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

-- Read: Everyone can read public exercises + own exercises
CREATE POLICY "Users can read public or own exercises"
  ON exercises FOR SELECT
  USING (is_public = true OR auth.uid()::text = user_id::text);

-- Insert: Users can insert own exercises, Admins can insert public exercises
CREATE POLICY "Users can insert exercises"
  ON exercises FOR INSERT
  WITH CHECK (
    (auth.uid()::text = user_id::text AND is_public = false) OR
    (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND is_admin = true))
  );

-- Update: Users can update own exercises, Admins can update public exercises
CREATE POLICY "Users can update exercises"
  ON exercises FOR UPDATE
  USING (
    (auth.uid()::text = user_id::text AND is_public = false) OR
    (is_public = true AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND is_admin = true))
  )
  WITH CHECK (
    (auth.uid()::text = user_id::text AND is_public = false) OR
    (is_public = true AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND is_admin = true))
  );

-- Delete: Users can delete own exercises, Admins can delete public exercises
CREATE POLICY "Users can delete exercises"
  ON exercises FOR DELETE
  USING (
    (auth.uid()::text = user_id::text AND is_public = false) OR
    (is_public = true AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND is_admin = true))
  );

-- Done! 🎉
-- Admins can now create, update, and delete public exercises
-- Regular users can only manage their own private exercises
