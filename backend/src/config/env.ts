import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Si es "true" y la base no tiene usuarios, el servidor carga los datos de ejemplo al arrancar (staging).
  SEED_DEMO: z.stringbool().default(false),
  // Zona horaria del negocio: define en qué día cae cada papelito (el servidor de Render corre en UTC).
  TZ_NEGOCIO: z.string().default('America/Argentina/Buenos_Aires'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
