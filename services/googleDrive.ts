
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';
import { GOOGLE_CLIENT_ID, DRIVE_BACKUP_FILENAME } from '../constants';

export interface BackupData {
  timestamp: string;
  data: any;
  device: string;
}

let isInitialized = false;

// Keys for storage
const TOKEN_KEY = 'g_drive_token';
const EXPIRY_KEY = 'g_drive_token_expiry';

/**
 * 1. Initialize - Only needed for Native Plugin
 */
export const initializeGoogleDrive = async (): Promise<void> => {
  if (isInitialized) return;
  
  if (Capacitor.isNativePlatform()) {
    try {
      console.log("Initializing SocialLogin plugin (Native)...");
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_CLIENT_ID,
          // FIX: Define scopes here during initialization to avoid native modification errors.
          scopes: ['email', 'profile', 'https://www.googleapis.com/auth/drive.file']
        }
      });
      isInitialized = true;
    } catch (e) {
      console.error("Failed to initialize Google Login:", e);
    }
  } else {
    isInitialized = true;
  }
};

/**
 * 2. Get Access Token
 * Hybrid approach: Uses Native Plugin on Android/iOS, and Google GIS Script on Web.
 */
export const getAccessToken = async (forceRefresh: boolean = false): Promise<string> => {
  if (!isInitialized) {
    await initializeGoogleDrive();
  }

  // 1. Check local storage cache first
  const savedToken = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);

  // Safety margin of 5 minutes (300000 ms)
  if (!forceRefresh && savedToken && expiry && Date.now() < (parseInt(expiry, 10) - 300000)) {
    console.log("Using cached Google Drive token.");
    return savedToken;
  }

  console.log("Requesting new Google Access Token...");

  // ---------------------------------------------------------
  // NATIVE STRATEGY (Android / iOS)
  // ---------------------------------------------------------
  if (Capacitor.isNativePlatform()) {
    try {
      // FIX: Scopes are now defined in initialize(). We just need to trigger the login.
      const response = await SocialLogin.login({
        provider: 'google'
      });

      if (!response.result) {
        throw new Error("No result received from Google Login");
      }

      // Robust token extraction
      let finalToken = '';
      if (response.result.accessToken) {
         finalToken = typeof response.result.accessToken === 'string' 
            ? response.result.accessToken 
            : response.result.accessToken.token;
      }

      // Verify we got a token
      if (!finalToken) {
        console.warn("No accessToken found in response:", response.result);
        if (response.result.idToken) {
           console.log("Falling back to idToken (Warning: might not work for Drive API)");
           finalToken = response.result.idToken;
        } else {
           throw new Error("Authentication successful but no token received.");
        }
      }

      // Cache token (Native tokens usually last 1 hour)
      const expiresIn = 3600; 
      const expiryTime = Date.now() + (expiresIn * 1000);
      localStorage.setItem(TOKEN_KEY, finalToken);
      localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
      
      return finalToken;

    } catch (err: any) {
      console.error("Native Google Login Error:", err);
      
      // DEBUG: Visa felmeddelande direkt i appen för att se vad som är fel på APK:n
      const errMsg = err?.message || JSON.stringify(err);
      alert(`Inloggning misslyckades: ${errMsg}`);
      
      throw err;
    }
  } 
  
  // ---------------------------------------------------------
  // WEB STRATEGY (Cloud Run / Browser) - The "Old Way"
  // ---------------------------------------------------------
  else {
    return new Promise((resolve, reject) => {
      // Ensure Google script is loaded
      if (!(window as any).google || !(window as any).google.accounts) {
        console.error("Google script not loaded");
        alert("Kunde inte ladda Google-inloggning. Kontrollera din internetanslutning eller ladda om sidan.");
        reject("Google script missing");
        return;
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error) {
            console.error("Google Auth Error:", response);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(EXPIRY_KEY);
            reject(response);
          } else {
            const expiresIn = response.expires_in || 3599; 
            const expiryTime = Date.now() + (expiresIn * 1000);
            
            localStorage.setItem(TOKEN_KEY, response.access_token);
            localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
            
            resolve(response.access_token);
          }
        },
      });

      // Trigger the popup
      client.requestAccessToken();
    });
  }
};

/**
 * 3. Find the backup file
 */
export const listBackups = async (): Promise<any[]> => {
  const token = await getAccessToken();
  console.log("Listing backups...");

  const url = `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_BACKUP_FILENAME}' and trashed=false&fields=files(id,name,createdTime)`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
    }
    const err = await response.text();
    console.error("List Backups Failed:", err);
    throw new Error("Could not list files: " + response.statusText);
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * 4. Upload Backup
 */
export const uploadBackup = async (data: any): Promise<void> => {
  console.log("Starting upload process...");
  const token = await getAccessToken();
  
  const fileName = DRIVE_BACKUP_FILENAME;
  const fileContent = JSON.stringify({
    timestamp: new Date().toISOString(),
    device: Capacitor.getPlatform(),
    data: data
  }, null, 2);

  const fileBlob = new Blob([fileContent], { type: 'application/json' });
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileBlob);

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  try {
    const existingFiles = await listBackups();
    if (existingFiles.length > 0) {
      const fileId = existingFiles[0].id;
      console.log(`Overwriting existing file: ${fileId}`);
      url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
      method = 'PATCH';
    }
  } catch (err) {
    console.warn("Could not check for existing files, trying to create a new one.", err);
  }
  
  const response = await fetch(url, {
    method: method,
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errorText}`);
  }
  console.log("Upload successful!");
};

/**
 * 5. Download backup
 */
export const downloadBackup = async (fileId: string): Promise<BackupData> => {
  const token = await getAccessToken();
  console.log(`Downloading file: ${fileId}`);

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to download file');
  }
  
  const data = await response.json();
  return data as BackupData;
};

/**
 * 6. Sign out
 */
export const signOutGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch (e) {
      console.warn("Native logout failed", e);
    }
  } else {
    // Web logout (just revoke token)
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && (window as any).google) {
        (window as any).google.accounts.oauth2.revoke(token, () => {
            console.log('Consent revoked');
        });
    }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
};
