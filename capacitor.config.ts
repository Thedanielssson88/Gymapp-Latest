import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thedanielssson88.morphfit', // Ditt rätta Package Name
  appName: 'MorphFit', // Eller vad appen ska heta på hemskärmen
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SocialLogin: {
      google: {
        // Ditt Android Client ID (som du gav mig nyss)
        androidClientId: "780206293738-nkgmka7s5thm4uhaln0kbte42hflu2bs.apps.googleusercontent.com",
        
        // VIKTIGT: Du måste skapa ett "Web application" Client ID i Google Cloud Console också.
        // Det används för att genomföra själva inloggnings-handskakningen.
        webClientId: "780206293738-sk4o73pko8gu6at1qtpma3ifg9noq9k1.apps.googleusercontent.com"
      }
    }
  }
};

export default config;