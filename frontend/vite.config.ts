import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://wittehsieh.github.io/english-training/
// so every asset URL must be prefixed with the repo name.
export default defineConfig({
  base: '/english-training/',
  plugins: [react()],
  server: {
    port: 5173,
  },
});
