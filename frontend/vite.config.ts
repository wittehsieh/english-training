import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://wittehsieh.github.io/english-training/
// so every asset URL must be prefixed with the repo name.
export default defineConfig({
  base: '/english-training/',
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on the LAN so a phone on the same Wi-Fi can open the dev site.
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
