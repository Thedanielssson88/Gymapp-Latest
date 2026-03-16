# 🔧 Fix: Kan inte spara rutiner (403 Forbidden)

## Problem
När du klickar "Spara Rutin" i "Skapa Rutin" så får du felmeddelandet:
```
POST https://maviagpzwdjywatckgii.supabase.co/rest/v1/workout_routines 403 (Forbidden)
```

**Orsak:** `workout_routines` tabellen saknar RLS (Row Level Security) policies som tillåter INSERT/UPDATE.

## Lösning

### Steg 1: Logga in i Supabase
1. Gå till: https://supabase.com/dashboard
2. Välj ditt projekt (Gymapp)

### Steg 2: Öppna SQL Editor
1. Klicka på "SQL Editor" i vänstermenyn
2. Klicka på "New query"

### Steg 3: Kör SQL-fixen
1. Öppna filen: `/workspace/group/Byggen/Gymapp/fix-workout-routines-rls.sql`
2. Kopiera HELA innehållet
3. Klistra in i Supabase SQL Editor
4. Klicka "Run" (eller tryck Ctrl+Enter)

### Steg 4: Verifiera
Du bör se följande output:
```
ALTER TABLE
DROP POLICY
DROP POLICY
DROP POLICY
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE INDEX
```

### Steg 5: Testa appen
1. Gå till appen
2. Gå till "Skapa Rutin"
3. Skapa en rutin och klicka "Spara Rutin"
4. Det ska nu fungera! ✅

## Vad gör SQL-fixen?

SQL-scriptet:
1. ✅ Aktiverar RLS på `workout_routines` tabellen
2. ✅ Skapar 4 policies:
   - **SELECT**: Användare kan se sina egna rutiner
   - **INSERT**: Användare kan skapa rutiner
   - **UPDATE**: Användare kan uppdatera sina egna rutiner
   - **DELETE**: Användare kan ta bort sina egna rutiner
3. ✅ Skapar index för snabbare queries

Alla policies kontrollerar att `user_id = auth.uid()::text` så användare kan bara se/ändra sina egna rutiner.

---

**Tips:** Om du får samma fel för andra tabeller (scheduled_activities, recurring_plans, etc.), kolla att de också har rätt RLS policies!
