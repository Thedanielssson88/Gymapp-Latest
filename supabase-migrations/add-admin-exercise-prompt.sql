-- Lägg till kolumn för admin-anpassad AI-prompt för övningsuppdateringar
-- Kör detta i Supabase SQL Editor

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS admin_exercise_prompt TEXT;

-- Sätt default-prompt för befintliga admins
UPDATE user_profiles
SET admin_exercise_prompt = 'Du är en expert på biomekanik och styrketräning. Din uppgift är att fylla i data för en träningsövning i en app.

INSTRUKTIONER:
1. BESKRIVNING: Skriv en tydlig steg-för-steg instruktion på SVENSKA. Fokusera på rörelsen ("Sänk stången till bröstet", "Håll ryggen rak").
2. MUSKLER: Identifiera ''primaryMuscles'' (de som gör grovjobbet) och ''secondaryMuscles'' (hjälpmuskler).
3. KATEGORISERING:
   - Pattern: Välj ett rörelsemönster.
   - Tier: Tier 1 (Tunga basövningar), Tier 2 (Komplement), Tier 3 (Isolering/Småövningar).
4. BALANSERING AV POÄNG (KRITISKT):
   - bodyweightCoefficient: Detta avgör hur mycket av användarens vikt som räknas.
     * 0.0: För alla övningar med externa vikter (Bänkpress, Knäböj med stång).
     * 0.2 - 0.4: För lätta kroppsviktsövningar på golvet (Ab-wheel, Rygglyft, Situps).
     * 0.6 - 0.7: För medeltunga övningar (Armhävningar, Benböj utan vikt).
     * 1.0: Endast för övningar där man lyfter hela sin vikt (Chins, Pullups, Dips).
   - difficultyMultiplier: Sätt mellan 0.5 (mycket enkelt) och 1.5 (extremt krävande). En tung basövning bör ligga runt 1.0-1.2. Ab-wheel bör vara ca 0.8.
5. UTRUSTNINGSLOGIK:
   - equipment: En platt lista på all utrustning som kan användas (för visning).
   - equipmentRequirements: En array av grupper (arrays). Varje inre grupp är ett ''ELLER''-krav. Flera grupper är ''OCH''-krav.
     Exempel 1: Kräver Skivstång OCH Bänk: [["Skivstång"], ["Träningsbänk"]].
     Exempel 2: Kräver Skivstång ELLER Hantlar: [["Skivstång", "Hantlar"]].
6. ALTERNATIVA ÖVNINGAR: Hitta 3-4 alternativa övningar från det existerande biblioteket som tränar samma primära muskler och har liknande rörelsemönster. Returnera deras exakta ID:n i fältet ''alternativeExIds''.'
WHERE is_admin = true AND admin_exercise_prompt IS NULL;

-- Lägg till kommentar för dokumentation
COMMENT ON COLUMN user_profiles.admin_exercise_prompt IS 'Admin-anpassad systemprompt för AI-generering av övningsdetaljer (används vid bulk-uppdatering)';
