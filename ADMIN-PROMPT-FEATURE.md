# 🎨 Admin AI Prompt Editor

## ✅ Vad har gjorts?

Nu kan admin-användare redigera AI-prompten som används för bulk-uppdatering av övningar!

### Funktionalitet:

1. **Prompt-Modal**: När du trycker på "AI" i bulk-läge öppnas en modal där du kan:
   - Se den aktuella AI-system-prompten
   - Redigera prompten innan du kör AI-uppdateringen
   - Spara prompten för framtida användning

2. **Persistent Lagring**: Prompten sparas i Supabase (`user_profiles.admin_exercise_prompt`)

3. **Default-Prompt**: Om ingen prompt är sparad används standard-prompten (samma som tidigare)

---

## 📋 Installation

### Steg 1: Lägg till kolumn i Supabase

**Öppna Supabase Dashboard** → **SQL Editor** och kör:

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS admin_exercise_prompt TEXT;

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

COMMENT ON COLUMN user_profiles.admin_exercise_prompt IS 'Admin-anpassad systemprompt för AI-generering av övningsdetaljer (används vid bulk-uppdatering)';
```

**Eller använd filen:** `/workspace/group/Byggen/Gymapp/supabase-migrations/add-admin-exercise-prompt.sql`

### Steg 2: Bygg och deploya

```bash
npm run build
git add .
git commit -m "Add admin AI prompt editor for bulk exercise updates"
git push
```

---

## 🚀 Hur det fungerar

### 1. Välj övningar i bulk-läge

1. Gå till Bibliotek
2. Tryck på "Bulk"-knappen (endast synlig för admins)
3. Markera övningar genom att klicka på dem

### 2. Redigera AI-prompten

1. Tryck på "AI (X)"-knappen
2. En modal öppnas med prompten
3. Redigera prompten efter behov
4. Tryck på "Kör AI-Uppdatering"

### 3. Prompten sparas automatiskt

- När du trycker "Kör AI-Uppdatering" sparas prompten i din profil
- Nästa gång du öppnar modalen visas din sparade prompt
- Prompten gäller för alla framtida bulk-uppdateringar

---

## 🛠️ Tekniska detaljer

### Filer som ändrats:

- `components/ExerciseLibrary.tsx`:
  - Lagt till `showPromptEditor` och `editablePrompt` states
  - Lagt till `openPromptEditor()` funktion som hämtar sparad prompt
  - Uppdaterat `handleBulkAIUpdate()` för att spara prompten
  - Lagt till Prompt Editor Modal-komponent

- `services/geminiService.ts`:
  - Uppdaterat `generateExerciseDetailsFromGemini()` för att acceptera `customPrompt?` parameter
  - Använder custom prompt om den finns, annars default

- `services/storage.ts`:
  - `setUserProfile()` sparar nu `admin_exercise_prompt` till Supabase

### Databasschema:

```sql
user_profiles:
  - admin_exercise_prompt: TEXT (nullable)
```

---

## 🎯 Användningsexempel

### Exempel 1: Ändra fokus på beskrivningar

**Default-prompt fokuserar på:**
- Teknisk korrekthet
- Biomekanik
- Steg-för-steg instruktioner

**Du kan ändra till:**
```
Du är en expert på styrketräning. Skriv kortfattade, praktiska beskrivningar.

INSTRUKTIONER:
1. BESKRIVNING: Max 2-3 meningar. Fokusera på känslan och de viktigaste tipsen.
2. ... (resten)
```

### Exempel 2: Ändra svårighetsgrad-kalibrering

Du kan justera hur AI:n bedömer `difficultyMultiplier`:

```
4. BALANSERING AV POÄNG:
   - difficultyMultiplier: Sätt mellan 0.3 (extremt lätt) och 2.0 (extremt krävande).
     * 0.3-0.5: Mycket lätta övningar (Armhävningar mot vägg)
     * 0.8-1.0: Medelsvåra övningar (Bänkpress)
     * 1.5-2.0: Mycket krävande (Frontknäböj, Overhead Press)
```

---

## ✅ Nästa steg

1. Kör SQL-migreringen i Supabase
2. Deploya till Vercel (automatiskt via git push)
3. Testa bulk-uppdatering med anpassad prompt
4. Finjustera prompten efter behov

**Klart!** 🎉
