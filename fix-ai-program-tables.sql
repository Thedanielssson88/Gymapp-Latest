-- Fix AI Program related tables (scheduled_activities, ai_programs, user_missions)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- ==========================================
-- 1. FIX SCHEDULED_ACTIVITIES
-- ==========================================
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN DEFAULT false;
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS "linkedSessionId" TEXT;
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS exercises JSONB;
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS "recurrenceId" TEXT;
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE scheduled_activities ADD COLUMN IF NOT EXISTS "weekNumber" INTEGER;

-- RLS for scheduled_activities
DROP POLICY IF EXISTS "Users can read own scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can insert own scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can update own scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can delete own scheduled activities" ON scheduled_activities;

CREATE POLICY "Users can read own scheduled activities"
  ON scheduled_activities FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert own scheduled activities"
  ON scheduled_activities FOR INSERT
  WITH CHECK (auth.uid()::text = COALESCE(user_id::text, auth.uid()::text));

CREATE POLICY "Users can update own scheduled activities"
  ON scheduled_activities FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own scheduled activities"
  ON scheduled_activities FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Auto-set user_id trigger
CREATE OR REPLACE FUNCTION set_scheduled_activity_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS scheduled_activities_set_user_id ON scheduled_activities;
CREATE TRIGGER scheduled_activities_set_user_id
  BEFORE INSERT ON scheduled_activities
  FOR EACH ROW
  EXECUTE FUNCTION set_scheduled_activity_user_id();

-- ==========================================
-- 2. FIX AI_PROGRAMS
-- ==========================================
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS "goalIds" JSONB;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS weeks INTEGER;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS "phaseNumber" INTEGER;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS "longTermGoalDescription" TEXT;
ALTER TABLE ai_programs ADD COLUMN IF NOT EXISTS "startStats" JSONB;

-- RLS for ai_programs
DROP POLICY IF EXISTS "Users can read own ai programs" ON ai_programs;
DROP POLICY IF EXISTS "Users can insert own ai programs" ON ai_programs;
DROP POLICY IF EXISTS "Users can update own ai programs" ON ai_programs;
DROP POLICY IF EXISTS "Users can delete own ai programs" ON ai_programs;

CREATE POLICY "Users can read own ai programs"
  ON ai_programs FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert own ai programs"
  ON ai_programs FOR INSERT
  WITH CHECK (auth.uid()::text = COALESCE(user_id::text, auth.uid()::text));

CREATE POLICY "Users can update own ai programs"
  ON ai_programs FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own ai programs"
  ON ai_programs FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Auto-set user_id trigger
CREATE OR REPLACE FUNCTION set_ai_program_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ai_programs_set_user_id ON ai_programs;
CREATE TRIGGER ai_programs_set_user_id
  BEFORE INSERT ON ai_programs
  FOR EACH ROW
  EXECUTE FUNCTION set_ai_program_user_id();

-- ==========================================
-- 3. FIX USER_MISSIONS
-- ==========================================
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "smartConfig" JSONB;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN DEFAULT false;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS progress NUMERIC DEFAULT 0;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "completedAt" TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "exerciseId" TEXT;

-- RLS for user_missions
DROP POLICY IF EXISTS "Users can read own user missions" ON user_missions;
DROP POLICY IF EXISTS "Users can insert own user missions" ON user_missions;
DROP POLICY IF EXISTS "Users can update own user missions" ON user_missions;
DROP POLICY IF EXISTS "Users can delete own user missions" ON user_missions;

CREATE POLICY "Users can read own user missions"
  ON user_missions FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert own user missions"
  ON user_missions FOR INSERT
  WITH CHECK (auth.uid()::text = COALESCE(user_id::text, auth.uid()::text));

CREATE POLICY "Users can update own user missions"
  ON user_missions FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own user missions"
  ON user_missions FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Auto-set user_id trigger
CREATE OR REPLACE FUNCTION set_user_mission_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS user_missions_set_user_id ON user_missions;
CREATE TRIGGER user_missions_set_user_id
  BEFORE INSERT ON user_missions
  FOR EACH ROW
  EXECUTE FUNCTION set_user_mission_user_id();

-- Done! 🎉
-- ✅ scheduled_activities fixed with camelCase columns + RLS + auto user_id
-- ✅ ai_programs fixed with camelCase columns + RLS + auto user_id
-- ✅ user_missions fixed with camelCase columns + RLS + auto user_id
