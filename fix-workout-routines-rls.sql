-- Fix RLS policies för workout_routines tabellen
-- Kör detta i Supabase SQL Editor för att fixa 403 Forbidden-felet

-- Aktivera RLS om det inte redan är aktiverat
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;

-- Ta bort gamla policies om de finns
DROP POLICY IF EXISTS "Users can view their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can insert their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can update their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can delete their own routines" ON workout_routines;

-- SELECT: Användare kan se sina egna rutiner
CREATE POLICY "Users can view their own routines"
ON workout_routines
FOR SELECT
USING (user_id = auth.uid()::text);

-- INSERT: Användare kan skapa rutiner (user_id sätts automatiskt till auth.uid())
CREATE POLICY "Users can insert their own routines"
ON workout_routines
FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

-- UPDATE: Användare kan uppdatera sina egna rutiner
CREATE POLICY "Users can update their own routines"
ON workout_routines
FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- DELETE: Användare kan ta bort sina egna rutiner
CREATE POLICY "Users can delete their own routines"
ON workout_routines
FOR DELETE
USING (user_id = auth.uid()::text);

-- Skapa index för bättre performance
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id ON workout_routines(user_id);
