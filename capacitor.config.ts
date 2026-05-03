import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.nammametro.offline',
  appName: 'MetroMate Bengaluru',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
  server: {
    androidScheme: 'http',
    cleartext: true,
    errorPath: 'native-error.html',
    iosScheme: 'capacitor',
  },
};

export default config;
