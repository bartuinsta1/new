import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mirnavhani.game',
  appName: 'Mırnav Hanı',
  webDir: 'dist',
  backgroundColor: '#3b2b25',
  ios: { contentInset: 'never' },
  plugins: {
    // Android 15+ kenardan kenara: güvenli alanlar CSS env() ile; koyu zemin üstünde açık simgeler.
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK' },
  },
  // Android 7 cihazlarda WebView Play Store'dan güncellenir; Chrome 64 altını kabul etme.
  android: { backgroundColor: '#3b2b25', minWebViewVersion: 64 },
};

export default config;
