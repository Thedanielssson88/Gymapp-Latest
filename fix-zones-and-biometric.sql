-- Fix zones availablePlates + biometric_logs RLS
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- ==========================================
-- 1. FIX ZONES - Add availablePlates column
-- ==========================================
ALTER TABLE zones ADD COLUMN IF NOT EXISTS "availablePlates" JSONB;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS available_plates JSONB;

-- ==========================================
-- 2. FIX BIOMETRIC_LOGS - Add missing columns
-- ==========================================
-- Ensure user_id exists
ALTER TABLE biometric_logs ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add camelCase columns for app compatibility
ALTER TABLE biometric_logs ADD COLUMN IF NOT EXISTS "bodyMeasurements" JSONB;

-- ==========================================
-- 3. FIX BIOMETRIC_LOGS RLS POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Users can read own biometric logs" ON biometric_logs;
DROP POLICY IF EXISTS "Users can insert own biometric logs" ON biometric_logs;
DROP POLICY IF EXISTS "Users can update own biometric logs" ON biometric_logs;
DROP POLICY IF EXISTS "Users can delete own biometric logs" ON biometric_logs;

-- READ: Users can read their own logs
CREATE POLICY "Users can read own biometric logs"
  ON biometric_logs FOR SELECT
  USING (
    auth.uid()::text = user_id::text OR
    user_id IS NULL
  );

-- INSERT: Allow authenticated users to insert logs
-- Auto-populate user_id if not provided
CREATE POLICY "Users can insert own biometric logs"
  ON biometric_logs FOR INSERT
  WITH CHECK (
    auth.uid()::text = COALESCE(user_id::text, auth.uid()::text)
  );

-- UPDATE: Users can update their own logs
CREATE POLICY "Users can update own biometric logs"
  ON biometric_logs FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- DELETE: Users can delete their own logs
CREATE POLICY "Users can delete own biometric logs"
  ON biometric_logs FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ==========================================
-- 4. CREATE TRIGGER TO AUTO-SET user_id
-- ==========================================
-- This ensures user_id is always set on INSERT
CREATE OR REPLACE FUNCTION set_biometric_log_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS biometric_logs_set_user_id ON biometric_logs;
CREATE TRIGGER biometric_logs_set_user_id
  BEFORE INSERT ON biometric_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_biometric_log_user_id();

-- Done! 🎉
-- ✅ zones.availablePlates added
-- ✅ biometric_logs RLS fixed with auto user_id
