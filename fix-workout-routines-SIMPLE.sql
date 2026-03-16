-- ENKEL FIX för workout_routines (Kör detta i Supabase SQL Editor)

-- 1. Lägg till user_id kolumn
ALTER TABLE workout_routines ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Aktivera RLS
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;

-- 3. Ta bort gamla policies
DROP POLICY IF EXISTS "Users can view their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can insert their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can update their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can delete their own routines" ON workout_routines;

-- 4. SELECT policy
CREATE POLICY "Users can view their own routines" ON workout_routines
FOR SELECT USING (user_id = auth.uid()::text);

-- 5. INSERT policy
CREATE POLICY "Users can insert their own routines" ON workout_routines
FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- 6. UPDATE policy
CREATE POLICY "Users can update their own routines" ON workout_routines
FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- 7. DELETE policy
CREATE POLICY "Users can delete their own routines" ON workout_routines
FOR DELETE USING (user_id = auth.uid()::text);

-- 8. Index
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id ON workout_routines(user_id);
