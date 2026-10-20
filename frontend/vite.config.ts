import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En local, /api va al backend. En staging/producción se usa VITE_API_URL.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
