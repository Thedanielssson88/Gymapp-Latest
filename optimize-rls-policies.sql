-- OPTIMIZED RLS POLICIES - Använd funktion istället för subquery
-- Detta fixar långsamma queries genom att cacha admin-check

-- 1. Skapa en funktion som kollar om användaren är admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()::text
    AND COALESCE(is_admin, false) = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop gamla policies
DROP POLICY IF EXISTS "Users can read public or own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises" ON exercises;

-- 3. Skapa NYA optimerade policies med funktionen

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
    -- Admin creating public exercise (ANVÄND FUNKTION!)
    (COALESCE(is_public, false) = true AND is_admin())
  );

-- UPDATE: Users update own exercises, Admins update public exercises
CREATE POLICY "Users can update exercises"
  ON exercises FOR UPDATE
  USING (
    -- User's own private exercise
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    -- Admin updating public exercise (ANVÄND FUNKTION!)
    (COALESCE(is_public, false) = true AND is_admin())
  )
  WITH CHECK (
    -- Same as USING clause
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND is_admin())
  );

-- DELETE: Users delete own exercises, Admins delete public exercises
CREATE POLICY "Users can delete exercises"
  ON exercises FOR DELETE
  USING (
    -- User's own private exercise
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    -- Admin deleting public exercise (ANVÄND FUNKTION!)
    (COALESCE(is_public, false) = true AND is_admin())
  );

-- 4. Indexera viktiga kolumner för snabbare queries
CREATE INDEX IF NOT EXISTS idx_exercises_is_public ON exercises(is_public);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin ON user_profiles(is_admin) WHERE is_admin = true;

-- Done! Detta bör fixa långsamma queries 🚀
