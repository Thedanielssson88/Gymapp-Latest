-- FINAL FIX: Replace ALL exercise policies with correct ones
-- This handles both public exercises and admin permissions

-- 1. Drop ALL possible policy names
DROP POLICY IF EXISTS "Users can read public or own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises" ON exercises;
DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

-- 2. Create NEW policies with is_public and admin support
-- READ: Anyone can read public exercises OR their own exercises
CREATE POLICY "Users can read public or own exercises"
  ON exercises FOR SELECT
  USING (
    is_public = true OR
    auth.uid()::text = user_id::text OR
    user_id IS NULL
  );

-- INSERT: Users insert own exercises, Admins insert public exercises
CREATE POLICY "Users can insert exercises"
  ON exercises FOR INSERT
  WITH CHECK (
    -- User's own private exercise
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    -- Admin creating public exercise
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

-- UPDATE: Users update own exercises, Admins update public exercises
CREATE POLICY "Users can update exercises"
  ON exercises FOR UPDATE
  USING (
    -- User's own private exercise
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    -- Admin updating public exercise
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  )
  WITH CHECK (
    -- Same as USING clause
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

-- DELETE: Users delete own exercises, Admins delete public exercises
CREATE POLICY "Users can delete exercises"
  ON exercises FOR DELETE
  USING (
    -- User's own private exercise
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    -- Admin deleting public exercise
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

-- Done! 🎉
-- Now admins can create/update/delete public exercises
-- Regular users can only manage their own private exercises
