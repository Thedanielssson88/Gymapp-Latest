-- Fix user_missions columns - Add camelCase columns
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- Ensure all columns exist (both snake_case and camelCase for compatibility)
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS smart_config JSONB;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS progress NUMERIC DEFAULT 0;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS created_at TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS completed_at TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS exercise_id TEXT;

-- Add camelCase versions for app compatibility
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "smartConfig" JSONB;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN DEFAULT false;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "completedAt" TEXT;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS "exerciseId" TEXT;

-- RLS policies
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
-- ✅ user_missions has both snake_case and camelCase columns
-- ✅ RLS policies configured
-- ✅ Auto user_id trigger
