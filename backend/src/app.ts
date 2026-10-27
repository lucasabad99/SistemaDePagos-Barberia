import fs from 'node:fs';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from './config/env';
import authRoutes from './routes/auth';
import catalogoRoutes from './routes/catalogo';
import usuariosRoutes from './routes/usuarios';
import ventasRoutes from './routes/ventas';
import liquidacionRoutes from './routes/liquidacion';

z.config(z.locales.es()); // mensajes de validación en español

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // detrás del proxy de Render, para que el rate limit vea la IP real
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, env: env.NODE_ENV, db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/catalogo', catalogoRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/ventas', ventasRoutes);
  app.use('/api/liquidacion', liquidacionRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));

  // En staging/producción el mismo servidor sirve la web compilada (frontend/dist).
  // En local no existe esa carpeta (o se ignora) y la web la sirve Vite.
  const webDist = path.resolve(__dirname, '../../frontend/dist');
  if (env.NODE_ENV !== 'development' && fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1y', immutable: true }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache'); // el index.html siempre fresco para tomar el deploy nuevo
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
