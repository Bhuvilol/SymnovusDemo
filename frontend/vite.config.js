import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${Number(process.env.PORT) || 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/devices': backendUrl,
      '/summary': backendUrl,
    },
  },
});
