-- Lägg till onboarding_completed kolumn i user_profiles
-- Detta förhindrar att onboarding visas vid inloggning (endast vid registrering)

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Sätt till true för alla befintliga användare (de har redan använt appen)
UPDATE user_profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- Done! Nu visas onboarding endast för NYA användare vid registrering
