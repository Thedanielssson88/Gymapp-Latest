# Vercel Deployment Guide för Gymapp

## Steg 1: Hämta Supabase API-nycklar

1. Gå till: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/settings/api
2. Kopiera dessa värden:
   - **Project URL**: `https://maviagpzwdjywatckgii.supabase.co`
   - **anon/public key**: (den långa nyckeln under "Project API keys")

## Steg 2: Deploya till Vercel

### Via Vercel Dashboard (Rekommenderat)

1. **Gå till**: https://vercel.com
2. **Logga in** med ditt GitHub-konto
3. **Klicka** "Add New Project"
4. **Välj** repository: `Thedanielssson88/Gymapp-Latest`
5. **Konfigurera Project Settings**:

   **Framework Preset**: `Vite`

   **Build Command**: `npm run build`

   **Output Directory**: `dist`

   **Install Command**: `npm install`

6. **Lägg till Environment Variables** (VIKTIGT!):

   Klicka på "Environment Variables" och lägg till:

   ```
   Name: VITE_SUPABASE_URL
   Value: https://maviagpzwdjywatckgii.supabase.co
   ```

   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: [din anon key från Supabase - se Steg 1]
   ```

   **OBS**: Gemini API key behövs INTE här - användare kan lägga till sin egen i appen.

7. **Klicka** "Deploy"

### Via Vercel CLI (Alternativ)

```bash
# Installera Vercel CLI
npm i -g vercel

# Gå till projekt-mappen
cd /path/to/Gymapp

# Logga in på Vercel
vercel login

# Deploya (följ promptsen)
vercel

# Lägg till environment variables
vercel env add VITE_SUPABASE_URL production
# Ange: https://maviagpzwdjywatckgii.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Ange: [din anon key]

# Deploya till production
vercel --prod
```

## Steg 3: Kör SQL-filen i Supabase

**VIKTIGT**: Innan du använder appen, kör SQL-setup:

1. Öppna: `/workspace/group/complete-setup-supabase.sql`
2. Kopiera hela innehållet
3. Gå till: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor
4. Klistra in och kör SQL-koden

Detta fixar:
- ✅ RLS policies för zones (så din data laddas)
- ✅ RLS policies för missions
- ✅ Storage bucket för övningsbilder
- ✅ RLS för alla andra tabeller

## Steg 4: Testa appen

1. Gå till din Vercel URL (t.ex. `https://gymapp-latest.vercel.app`)
2. Logga in med samma email som du använt tidigare
3. All din data ska nu laddas! 🎉

## Troubleshooting

### "Välkommen-skärmen visas trots att jag är inloggad"
- Kör SQL-filen från Steg 3 (fix-zones-table.sql saknas)
- Kontrollera att dina zones har `user_id` satt i Supabase

### "Kan inte logga in"
- Kontrollera att `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` är korrekt satta i Vercel
- Gå till Vercel Dashboard → Project Settings → Environment Variables

### "Bilder laddas inte"
- Kör `create-storage-bucket.sql` sektionen från complete-setup-supabase.sql
- Kontrollera Storage bucket i Supabase Dashboard

## Auto-deploy

När du pushar till GitHub kommer Vercel automatiskt att:
1. Detektera nya commits på `main` branch
2. Bygga och deploya automatiskt
3. Uppdatera din live-sajt

Inga manuella steg behövs efter initial setup! 🚀
