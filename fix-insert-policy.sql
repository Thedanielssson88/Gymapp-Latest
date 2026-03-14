-- Fix the INSERT policy for exercises table
-- This replaces the existing policy with the correct one

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can read public or own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises" ON exercises;
DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

-- Recreate policies with correct permissions
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

-- Done! Now users can insert their own exercises
