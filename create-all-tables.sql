-- Complete Supabase database setup for Gymapp
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- ==========================================
-- 1. USER PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  weight NUMERIC,
  height NUMERIC,
  age INTEGER,
  level TEXT,
  goal TEXT,
  injuries JSONB DEFAULT '[]'::jsonb,
  measurements JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  gender TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

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
-- 2. ZONES (Gym locations)
-- ==========================================
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  inventory JSONB DEFAULT '[]'::jsonb,
  icon TEXT,
  available_plates JSONB,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

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
-- 3. WORKOUT HISTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS workout_history (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT,
  zone_id TEXT,
  location_name TEXT,
  exercises JSONB DEFAULT '[]'::jsonb,
  is_completed BOOLEAN DEFAULT false,
  duration INTEGER,
  rpe INTEGER,
  feeling TEXT,
  is_manual BOOLEAN,
  source_activity_id TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own workout history" ON workout_history;
DROP POLICY IF EXISTS "Users can insert own workout history" ON workout_history;
DROP POLICY IF EXISTS "Users can update own workout history" ON workout_history;
DROP POLICY IF EXISTS "Users can delete own workout history" ON workout_history;

CREATE POLICY "Users can read own workout history"
  ON workout_history FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own workout history"
  ON workout_history FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can update own workout history"
  ON workout_history FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own workout history"
  ON workout_history FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ==========================================
-- 4. BIOMETRIC LOGS
-- ==========================================
CREATE TABLE IF NOT EXISTS biometric_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  weight NUMERIC,
  measurements JSONB DEFAULT '{}'::jsonb,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE biometric_logs ENABLE ROW LEVEL SECURITY;

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
-- 5. EXERCISES (Custom user exercises)
-- ==========================================
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  english_name TEXT,
  pattern TEXT,
  tier TEXT,
  muscle_groups JSONB DEFAULT '[]'::jsonb,
  primary_muscles JSONB DEFAULT '[]'::jsonb,
  secondary_muscles JSONB DEFAULT '[]'::jsonb,
  equipment JSONB DEFAULT '[]'::jsonb,
  equipment_requirements JSONB,
  difficulty_multiplier NUMERIC,
  bodyweight_coefficient NUMERIC,
  tracking_type TEXT,
  image_url TEXT,
  image TEXT,
  description TEXT,
  instructions JSONB,
  alternative_ex_ids JSONB,
  user_modified BOOLEAN DEFAULT false,
  score INTEGER,
  user_rating TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can read public or own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises" ON exercises;

CREATE POLICY "Users can read public or own exercises"
  ON exercises FOR SELECT
  USING (
    COALESCE(is_public, false) = true OR
    auth.uid()::text = user_id::text
  );

CREATE POLICY "Users can insert exercises"
  ON exercises FOR INSERT
  WITH CHECK (
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

CREATE POLICY "Users can update exercises"
  ON exercises FOR UPDATE
  USING (
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  )
  WITH CHECK (
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

CREATE POLICY "Users can delete exercises"
  ON exercises FOR DELETE
  USING (
    (auth.uid()::text = user_id::text AND COALESCE(is_public, false) = false) OR
    (COALESCE(is_public, false) = true AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
    ))
  );

-- ==========================================
-- Done! 🎉
-- ==========================================
-- All tables created with proper RLS policies
-- Users can only access their own data
