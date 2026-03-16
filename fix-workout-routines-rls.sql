-- Fix RLS policies för workout_routines tabellen
-- Kör detta i Supabase SQL Editor för att fixa 403 Forbidden-felet

-- Steg 1: Lägg till user_id kolumn om den inte finns
ALTER TABLE workout_routines
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Steg 2: Uppdatera befintliga rutiner med rätt user_id (om det finns några)
-- Detta sätter user_id till den inloggade användaren för alla rutiner som saknar user_id
UPDATE workout_routines
SET user_id = auth.uid()::text
WHERE user_id IS NULL;

-- Steg 3: Aktivera RLS om det inte redan är aktiverat
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;

-- Steg 4: Ta bort gamla policies om de finns
DROP POLICY IF EXISTS "Users can view their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can insert their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can update their own routines" ON workout_routines;
DROP POLICY IF EXISTS "Users can delete their own routines" ON workout_routines;

-- Steg 5: Skapa nya policies

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

-- Steg 6: Skapa index för bättre performance
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id ON workout_routines(user_id);
