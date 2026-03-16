-- Fix RLS policies för workout_routines tabellen (Version 2)
-- Kör detta i Supabase SQL Editor för att fixa 403 Forbidden-felet

-- Steg 1: Lägg till user_id kolumn om den inte finns
ALTER TABLE workout_routines
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Steg 2: Aktivera RLS (gör detta INNAN vi skapar policies)
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;

-- Steg 3: Ta bort gamla policies om de finns
DROP POLICY IF EXISTS "Users can view their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can insert their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can update their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can delete their own routines" ON workout_routines;

-- Steg 4: Skapa nya policies

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

-- Steg 5: Skapa index för bättre performance
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id ON workout_routines(user_id);

-- Steg 6: Visa befintliga rutiner (om några finns)
-- Detta är bara för att verifiera - du kan ta bort denna rad om du vill
SELECT id, name, user_id FROM workout_routines;
