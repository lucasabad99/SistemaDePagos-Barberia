import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En Render NODE_ENV vale "staging" (lo necesita el backend), y Vite armaría el frontend en modo
// desarrollo: React lento y sin service worker. El build siempre es de producción.
if (process.argv.includes('build')) process.env.NODE_ENV = 'production';

export default defineConfig({
  plugins: [react()],
  // Fecha y hora del build: se muestra chiquita en la app para saber qué versión tiene cada celu.
  define: {
    __VERSION__: JSON.stringify(
      new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    ),
  },
  server: {
    port: 5173,
    // En local, /api va al backend. En staging/producción se usa VITE_API_URL.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
