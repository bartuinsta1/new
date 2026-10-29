import { defineConfig } from 'vite';

// iOS 15+ (WKWebView) ve Android 7+ (WebView Chrome 64+) için derle.
// Daha eski WebView'da Capacitor kullanıcıdan WebView güncellemesini ister (capacitor.config.ts).
export default defineConfig({
  base: './',
  build: {
    target: ['chrome64', 'safari15', 'ios15'],
    cssTarget: ['chrome64', 'safari15', 'ios15'],
    outDir: 'dist',
  },
});
