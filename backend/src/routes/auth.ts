import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Usuario } from '../models/Usuario';
import { firmarToken, requireAuth } from '../middleware/auth';

const router = Router();

// Un PIN de 4 dígitos se adivina rápido por fuerza bruta: limitamos los intentos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

const loginSchema = z.object({
  usuario: z.string().trim().toLowerCase().min(1),
  pin: z.string().trim().min(4).max(8),
});

router.post('/login', loginLimiter, async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Completá usuario y PIN' });

  const u = await Usuario.findOne({ usuario: body.data.usuario }).select('+pinHash');
  if (!u || !(await u.verificarPin(body.data.pin))) {
    return res.status(401).json({ error: 'Usuario o PIN incorrecto.' });
  }
  if (!u.activo) return res.status(403).json({ error: 'Tu usuario está desactivado. Hablá con el dueño.' });

  const token = firmarToken({ uid: String(u._id), rol: u.rol });
  res.json({ token, usuario: u.toJSON() });
});

router.get('/me', requireAuth, async (req, res) => {
  const u = await Usuario.findById(req.auth!.uid);
  if (!u || !u.activo) return res.status(401).json({ error: 'Usuario no disponible' });
  res.json({ usuario: u.toJSON() });
});

export default router;
