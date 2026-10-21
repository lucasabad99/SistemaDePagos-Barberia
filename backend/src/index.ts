import { env } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';
import { sembrarSiVacia } from './seed/datosEjemplo';

async function main() {
  await connectDB();
  await sembrarSiVacia();
  createApp().listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
