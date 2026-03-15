-- Lägg till encrypted_api_key kolumn i user_profiles tabellen
-- Kör detta i Supabase SQL Editor

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT;

-- Lägg till kommentar för dokumentation
COMMENT ON COLUMN user_profiles.encrypted_api_key IS 'Krypterad Gemini API-nyckel (AES-GCM krypterad med användarens user_id som nyckel)';
