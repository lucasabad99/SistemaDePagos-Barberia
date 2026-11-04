import { env } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';
import { hayDemo, localesDemo, sembrarSiVacia } from './seed/datosEjemplo';
import { prepararLocales } from './seed/locales';

async function main() {
  await connectDB();
  // Locales: los crea si faltan y asigna lo viejo. En local/staging, los barberos de ejemplo van a su local.
  await prepararLocales(hayDemo() ? { usuariosPorLocal: localesDemo, copiarStock: true } : {});
  await sembrarSiVacia();
  createApp().listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
