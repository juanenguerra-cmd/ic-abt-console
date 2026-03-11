import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { execSync } from 'child_process';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Returns a short git commit hash, or an ISO date string as fallback. */
function getBuildHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const buildId = `${new Date().toISOString().slice(0, 19).replace('T', '_')}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    base: '/',
    envPrefix: 'VITE_',
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__BUILD_ID__': JSON.stringify(buildId),
      '__GIT_HASH__': JSON.stringify(getBuildHash()),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'masked-icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          name: 'Infection Control Program',
          short_name: 'IC Console',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#2563eb',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});