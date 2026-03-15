# 🧬 Biologiskt Kön - Feature Implementation

## ✅ Vad har gjorts?

Implementerat möjlighet för användare att ange biologiskt kön (Man/Kvinna/Annan) i både välkomstskärmen och profilinställningar.

### Funktionalitet:

1. **Välkomstskärm (Onboarding)**:
   - Nytt steg (#2) efter namn där användaren väljer biologiskt kön
   - Tre alternativ: Man, Kvinna, Annan
   - Sparas automatiskt i profilen vid första uppsättningen

2. **Profilinställningar**:
   - Ny dropdown under "Profil"-sektionen
   - Användaren kan ändra sitt kön när som helst
   - Sparas till både Supabase och localStorage-cache

3. **Databaslagring**:
   - Sparas i `user_profiles.biological_sex` (TEXT med constraint)
   - Mappas mellan snake_case (SQL) och camelCase (TypeScript)

---

## 📋 Installation

### Steg 1: Lägg till kolumn i Supabase

**Öppna Supabase Dashboard** → **SQL Editor** och kör:

```sql
-- Lägg till kolumn för biologiskt kön
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS biological_sex TEXT;

-- Lägg till constraint för att endast tillåta giltiga värden
ALTER TABLE user_profiles
ADD CONSTRAINT biological_sex_check
CHECK (biological_sex IN ('Man', 'Kvinna', 'Annan') OR biological_sex IS NULL);

-- Lägg till kommentar för dokumentation
COMMENT ON COLUMN user_profiles.biological_sex IS 'Användarens biologiska kön (Man/Kvinna/Annan) - används för återhämtningsberäkningar och volymrekommendationer';
```

**Eller använd filen:** `/workspace/group/Byggen/Gymapp/supabase-migrations/add-biological-sex.sql`

### Steg 2: Bygg och deploya

```bash
npm run build
git add .
git commit -m "Add biological sex field to user profile and onboarding"
git push
```

---

## 🚀 Hur det fungerar

### 1. Första gången (Onboarding)

När en ny användare registrerar sig:
1. Namn (Steg 1)
2. **Biologiskt Kön (Steg 2)** ← NYTT!
3. Vikt (Steg 3)
4. Mål (Steg 4)
5. Gym & Utrustning (Steg 5)

### 2. Befintliga användare (Profilinställningar)

Befintliga användare kan när som helst:
1. Gå till "Profil"-fliken
2. Scrolla till "Profil"-sektionen
3. Välja biologiskt kön från dropdown
4. Tryck "Spara Inställningar"

---

## 🛠️ Tekniska detaljer

### Filer som ändrats:

#### 1. `types.ts`
- Lagt till `biologicalSex?: 'Man' | 'Kvinna' | 'Annan'` i UserProfile interface

#### 2. `components/OnboardingWizard.tsx`
- Uppdaterat `totalSteps` från 4 till 5
- Lagt till state: `biologicalSex`
- Lagt till nytt steg (#2) med könsval
- Sparar `biologicalSex` till profilen vid avslutad onboarding
- Uppdaterat progress indicator till 5 steg

#### 3. `components/SettingsView.tsx`
- Lagt till dropdown för biologiskt kön under "Profil"-sektionen
- Dropdown placerad efter "Vikt" och "Mål"
- Använder samma styling som övriga fält

#### 4. `services/storage.ts`
- **setUserProfile()**: Mappar `biologicalSex` (camelCase) → `biological_sex` (snake_case) för Supabase
- **getUserProfile()**: Mappar `biological_sex` (snake_case) → `biologicalSex` (camelCase) från Supabase
- Mappningen görs både för direkt hämtning och bakgrundscache-uppdatering

### Dataflöde:

```
TypeScript (camelCase)          Supabase (snake_case)
─────────────────────          ─────────────────────
biologicalSex: 'Man'    ─────>  biological_sex: 'Man'
                        <─────
```

### Databasschema:

```sql
user_profiles:
  - biological_sex: TEXT (nullable)
  - Constraint: IN ('Man', 'Kvinna', 'Annan') OR NULL
```

---

## 🎯 Framtida användning

Detta fält kan användas för:

1. **Återhämtningsberäkningar**:
   - Kvinnor: 48-60h återhämtningstid (snabbare)
   - Män: 60-72h återhämtningstid
   - Annan: Standard 60h

2. **Volymrekommendationer**:
   - Kvinnor: Högre volymtolerans (fler set)
   - Män: Högre intensitetstolerans (tyngre vikter)

3. **Kroppssammansättning**:
   - Olika beräkningar för kroppsfett % och BMI-tolkning

4. **AI-Coachens råd**:
   - Könsspecifika tips och rekommendationer

---

## ✅ Nästa steg

1. Kör SQL-migreringen i Supabase
2. Deploya till Vercel (automatiskt via git push)
3. Testa onboarding med ny användare
4. Testa att ändra kön i profilinställningar för befintlig användare
5. **Framtida:** Implementera könsbaserade beräkningar i `utils/recovery.ts`

**Klart!** 🎉
