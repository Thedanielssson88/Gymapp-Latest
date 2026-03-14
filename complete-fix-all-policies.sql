-- COMPLETE FIX: All tables with consistent policies
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- ==========================================
-- 1. ENSURE ALL COLUMNS EXIST
-- ==========================================

-- user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add camelCase columns for all tables (app compatibility)
ALTER TABLE workout_history ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN;
ALTER TABLE workout_history ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE workout_history ADD COLUMN IF NOT EXISTS "locationName" TEXT;
ALTER TABLE workout_history ADD COLUMN IF NOT EXISTS "isManual" BOOLEAN;
ALTER TABLE workout_history ADD COLUMN IF NOT EXISTS "sourceActivityId" TEXT;

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "alternativeExIds" JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "muscleGroups" JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "primaryMuscles" JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "secondaryMuscles" JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "equipmentRequirements" JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "difficultyMultiplier" NUMERIC;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "bodyweightCoefficient" NUMERIC;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "trackingType" TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "userModified" BOOLEAN;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS "userRating" TEXT;

-- ==========================================
-- 2. USER PROFILES POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid()::text = id::text OR auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  USING (auth.uid()::text = id::text OR auth.uid()::text = user_id::text);

-- ==========================================
-- 3. ZONES POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Users can read own zones" ON zones;
DROP POLICY IF EXISTS "Users can insert own zones" ON zones;
DROP POLICY IF EXISTS "Users can update own zones" ON zones;
DROP POLICY IF EXISTS "Users can delete own zones" ON zones;

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

-- ==========================================
-- 4. WORKOUT HISTORY POLICIES (KRITISK FIX!)
-- ==========================================
DROP POLICY IF EXISTS "Users can read own workout history" ON workout_history;
DROP POLICY IF EXISTS "Users can insert own workout history" ON workout_history;
DROP POLICY IF EXISTS "Users can update own workout history" ON workout_history;
DROP POLICY IF EXISTS "Users can delete own workout history" ON workout_history;

-- READ: Users can read their own workout history
CREATE POLICY "Users can read own workout history"
  ON workout_history FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- INSERT: Authenticated users can insert workout history
-- VIKTIGT: user_id sätts från appen, så vi måste kolla att det matchar auth.uid()
CREATE POLICY "Users can insert own workout history"
  ON workout_history FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id::text OR
    user_id IS NULL OR
    user_id = ''
  );

-- UPDATE: Users can update their own workout history
CREATE POLICY "Users can update own workout history"
  ON workout_history FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- DELETE: Users can delete their own workout history
CREATE POLICY "Users can delete own workout history"
  ON workout_history FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ==========================================
-- 5. BIOMETRIC LOGS POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Users can read own biometric logs" ON biometric_logs;
DROP POLICY IF EXISTS "Users can insert own biometric logs" ON biometric_logs;
DROP POLICY IF EXISTS "Users can update own biometric logs" ON biometric_logs;
DROP POLICY IF EXISTS "Users can delete own biometric logs" ON biometric_logs;

CREATE POLICY "Users can read own biometric logs"
  ON biometric_logs FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own biometric logs"
  ON biometric_logs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own biometric logs"
  ON biometric_logs FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own biometric logs"
  ON biometric_logs FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ==========================================
-- 6. EXERCISES POLICIES (MED ADMIN SUPPORT)
-- ==========================================
DROP POLICY IF EXISTS "Users can read public or own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises" ON exercises;
DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;

-- READ: Everyone can read public exercises + own exercises
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
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

-- UPDATE: Users update own exercises, Admins update public exercises
CREATE POLICY "Users can update exercises"
  ON exercises FOR UPDATE
  USING (
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  )
  WITH CHECK (
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
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

-- ==========================================
-- 7. SET YOUR ACCOUNT AS ADMIN
-- ==========================================
UPDATE user_profiles
SET is_admin = true
WHERE id = '2ae58e14-c176-4394-bc21-12b18cdd9e9b';

-- ==========================================
-- Done! 🎉
-- ==========================================
-- All tables updated with:
-- ✅ Consistent RLS policies
-- ✅ CamelCase column support
-- ✅ Admin role support
-- ✅ Workout history INSERT fixed
-- ✅ Your account set as admin
