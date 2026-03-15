-- Lägg till kolumn för biologiskt kön
-- Kör detta i Supabase SQL Editor

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS biological_sex TEXT;

-- Lägg till constraint för att endast tillåta giltiga värden
ALTER TABLE user_profiles
ADD CONSTRAINT biological_sex_check
CHECK (biological_sex IN ('Man', 'Kvinna', 'Annan') OR biological_sex IS NULL);

-- Lägg till kommentar för dokumentation
COMMENT ON COLUMN user_profiles.biological_sex IS 'Användarens biologiska kön (Man/Kvinna/Annan) - används för återhämtningsberäkningar och volymrekommendationer';
