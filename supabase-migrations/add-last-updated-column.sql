-- Lägg till lastUpdated kolumn i exercises tabellen
-- Kör detta i Supabase SQL Editor

ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS "lastUpdated" TIMESTAMPTZ;

-- Lägg till kommentar för dokumentation
COMMENT ON COLUMN exercises."lastUpdated" IS 'Tidsstämpel för senaste AI-uppdatering av övningsdetaljer';

-- Lägg till index för att snabbt hitta nyligen uppdaterade övningar
CREATE INDEX IF NOT EXISTS idx_exercises_last_updated ON exercises("lastUpdated");
