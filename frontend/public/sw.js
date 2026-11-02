// Service worker de Papelito.
// Criterio: siempre la red primero, para que cada apertura traiga la última versión publicada.
// Solo guarda una copia de la pantalla principal para mostrar algo si no hay conexión.
// Nunca guarda respuestas de /api: los datos siempre vienen del servidor.
const CACHE = 'papelito-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // API, assets, etc.: comportamiento normal del navegador
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put('/', copia));
        return res;
      })
      .catch(() =>
        caches.match('/').then(
          (r) =>
            r ||
            new Response('<meta name=viewport content="width=device-width"><p style="font:16px system-ui;padding:24px">Sin conexión. Revisá internet y volvé a abrir Papelito.</p>', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }),
        ),
      ),
  );
});
