import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mirnavhani.game',
  appName: 'Mırnav Hanı',
  webDir: 'dist',
  backgroundColor: '#3b2b25',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#3b2b25' },
};

export default config;
