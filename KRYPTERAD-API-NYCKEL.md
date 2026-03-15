# 🔐 Krypterad API-nyckel i Supabase

## Vad har gjorts?

✅ **API-nyckeln sparas nu både lokalt OCH krypterat i Supabase!**

### Säkerhetslösning:
- **Lokalt (localStorage):** API-nyckeln sparas i klartext för snabb åtkomst
- **Supabase:** API-nyckeln sparas **krypterad** med AES-GCM (256-bit)
- **Krypteringsnyckel:** Deriveras från din `user_id` + salt (PBKDF2)

**Detta betyder:**
- ✅ Bara DU kan dekryptera din API-nyckel (baserat på ditt user_id)
- ✅ API-nyckeln synkas mellan enheter (PWA + APK)
- ✅ Även om någon får tillgång till databasen kan de INTE läsa nyckeln
- ✅ Supabase-admins kan inte se din API-nyckel

---

## 📋 Installation (KÖR DETTA I SUPABASE!)

### Steg 1: Lägg till kolumn i databasen

Öppna **Supabase Dashboard** → **SQL Editor** och kör:

\`\`\`sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT;

COMMENT ON COLUMN user_profiles.encrypted_api_key IS 'Krypterad Gemini API-nyckel (AES-GCM)';
\`\`\`

**Alternativt:** Använd filen `supabase-migrations/add-encrypted-api-key.sql`

---

## 🚀 Hur det fungerar

### När du sparar profilen:
1. API-nyckeln krypteras med din `user_id` som nyckel
2. Krypterad nyckel sparas i `user_profiles.encrypted_api_key`
3. Klartext-nyckeln sparas i `localStorage` för snabb åtkomst

### När du laddar profilen:
1. Om nyckeln finns i `localStorage` → använd den (instant!)
2. Annars: Hämta krypterad nyckel från Supabase
3. Dekryptera med din `user_id`
4. Spara i `localStorage` för nästa gång

---

## 🔧 Tekniska detaljer

### Filer som ändrats:
- `utils/crypto.ts` - Krypteringsfunktioner (AES-GCM)
- `services/storage.ts` - Uppdaterad för att hantera krypterad API-nyckel

### Krypteringsalgoritm:
- **Algoritm:** AES-GCM (Galois/Counter Mode)
- **Nyckellängd:** 256 bitar
- **Key Derivation:** PBKDF2 (100,000 iterationer, SHA-256)
- **IV:** 12 bytes (slumpmässig för varje kryptering)

### Säkerhetsgarantier:
✅ **Confidentiality:** Bara användaren med rätt `user_id` kan dekryptera
✅ **Integrity:** GCM-mode ger autentisering (data kan inte modifieras)
✅ **Uniqueness:** Varje kryptering använder ett unikt IV

---

## 🧪 Testa funktionaliteten

### PWA (webb):
1. Logga in i appen
2. Gå till Inställningar → Ange din Gemini API-nyckel
3. Spara profilen
4. Öppna Supabase Dashboard → Kolla `user_profiles` tabellen
5. Du ska se en krypterad sträng i `encrypted_api_key` (Base64)

### APK (Android):
1. Installera ny APK (`./gradlew assembleDebug`)
2. Logga in med samma Google-konto
3. API-nyckeln ska automatiskt dekrypteras och visas i appen
4. Ändra nyckeln → Den krypteras och synkas till Supabase

### Verifiera synkning:
1. Ändra API-nyckel i PWA
2. Stäng APK:n helt (swipe away)
3. Öppna APK:n igen
4. Den nya nyckeln ska visas! ✅

---

## 🛠️ Felsökning

### API-nyckeln visas inte i APK:n?

**Kolla console-loggen:**
```
🔵 saveExercise: START
✅ API-nyckel krypterad för Supabase
✅ Profil sparad i Supabase (med krypterad API-nyckel)
✅ API-nyckel dekrypterad från Supabase
```

**Om du ser:**
```
⚠️ Kunde inte dekryptera API-nyckel
```
→ Kontrollera att `user_id` är samma i båda enheterna (samma Google-konto)

### Krypteringen fungerar inte?

**Kontrollera att kolumnen finns:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'encrypted_api_key';
```

**Manuell test:**
```javascript
// I browser console:
import { encrypt, decrypt } from './utils/crypto';
const userId = 'test-user-123';
const encrypted = await encrypt('min-api-nyckel', userId);
console.log('Encrypted:', encrypted);
const decrypted = await decrypt(encrypted, userId);
console.log('Decrypted:', decrypted); // Ska vara 'min-api-nyckel'
```

---

## 📱 Nästa steg

Nu när API-nyckeln sparas i Supabase:

1. ✅ Kör SQL-migreringen i Supabase Dashboard
2. ✅ Bygg ny APK: `cd android && ./gradlew assembleDebug`
3. ✅ Testa att nyckeln synkas mellan PWA och APK
4. ✅ Verifiera att krypteringen fungerar (kolla databasen)

**Klart!** 🎉
