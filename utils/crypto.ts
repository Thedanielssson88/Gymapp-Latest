/**
 * Krypteringsfunktioner för känslig data
 * Använder Web Crypto API (AES-GCM) för att kryptera data innan den sparas i Supabase
 */

// Konstant salt för att generera en konsekvent nyckel från användar-ID
const SALT = 'morphfit-v1-encryption-salt-2025';

/**
 * Genererar en krypteringsnyckel baserad på användar-ID
 * Samma user_id ger alltid samma nyckel (deterministisk)
 */
async function deriveKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Kombinera userId med ett salt för att skapa nyckelmaterial
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derivera en AES-nyckel från keyMaterial
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Krypterar en sträng med AES-GCM
 * @param plaintext - Den okrypterade texten
 * @param userId - Användarens ID (används för att generera nyckel)
 * @returns Base64-kodad krypterad data med IV
 */
export async function encrypt(plaintext: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await deriveKey(userId);

  // Generera ett slumpmässigt IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Kryptera data
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Kombinera IV + encrypted data och konvertera till Base64
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Dekrypterar en krypterad sträng
 * @param encryptedBase64 - Base64-kodad krypterad data
 * @param userId - Användarens ID (används för att generera nyckel)
 * @returns Den dekrypterade texten
 */
export async function decrypt(encryptedBase64: string, userId: string): Promise<string> {
  const decoder = new TextDecoder();
  const key = await deriveKey(userId);

  // Konvertera från Base64
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  // Extrahera IV (första 12 bytes) och encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  // Dekryptera
  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );

  return decoder.decode(decryptedData);
}
