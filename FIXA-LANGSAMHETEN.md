# 🐌 → ⚡ FIXA LÅNGSAMHETEN I SUPABASE

## Problem
Appen tar 15+ sekunder att ladda efter refresh eftersom `refreshData()` hämtar data från Supabase.

**Orsak:** RLS-policies på `exercises`-tabellen kör en subquery mot `user_profiles` för VARJE rad, vilket är extremt långsamt!

```sql
-- LÅNGSAMT (nuvarande):
EXISTS (
  SELECT 1 FROM user_profiles
  WHERE id = auth.uid()::text AND COALESCE(is_admin, false) = true
)
```

Detta körs för varje övning → 300 övningar = 300 subqueries! 😱

## Lösning

Kör SQL-filen `optimize-rls-policies.sql` i Supabase Dashboard:

### Steg 1: Logga in i Supabase
1. Gå till: https://supabase.com/dashboard
2. Välj ditt projekt (Gymapp)

### Steg 2: Öppna SQL Editor
1. Klicka på "SQL Editor" i vänstermenyn
2. Klicka på "New query"

### Steg 3: Kör SQL
1. Kopiera HELA innehållet från `/workspace/group/Byggen/Gymapp/optimize-rls-policies.sql`
2. Klistra in i SQL Editor
3. Klicka "Run" (Ctrl+Enter)

### Steg 4: Verifiera
Du bör se:
```
CREATE FUNCTION
DROP POLICY
DROP POLICY
DROP POLICY
DROP POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

### Steg 5: Testa appen
1. Gå till https://gymapp-khaki.vercel.app/
2. Gör en hård refresh (Ctrl+Shift+R)
3. Appen bör ladda på **1-2 sekunder** istället för 15+ sekunder! 🚀

## Vad gör ändringen?

**FÖRE:**
- För varje övning → Kör subquery mot `user_profiles` → Kolla om admin
- 300 övningar × 1 subquery = 300 databas-queries! 😱

**EFTER:**
- Skapa en funktion `is_admin()` som cachas av PostgreSQL
- För varje övning → Kör funktionen (cached) → Kolla om admin
- 300 övningar × 0 extra queries = Instant! ⚡

**BONUS:** Tre index skapas för ännu snabbare queries:
- `idx_exercises_is_public` - Snabb filtrering på publika övningar
- `idx_exercises_user_id` - Snabb lookup av användarens övningar
- `idx_user_profiles_admin` - Snabb admin-check

## Förväntat resultat

**FÖRE:** 15+ sekunder
```
📥 refreshData - Hämtar alla data från Supabase...
⚠️ refreshData timeout efter 15s
```

**EFTER:** 1-2 sekunder
```
📥 refreshData - Hämtar alla data från Supabase...
🔍 refreshData - Profil: Andreas
🔍 refreshData - Zoner: 2
✅ refreshData klar!
```

---

**Tips:** Om det fortfarande är långsamt, kolla Network-fliken i Chrome DevTools för att se vilken Supabase-query som tar längst tid!
