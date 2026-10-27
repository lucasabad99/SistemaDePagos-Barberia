import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { PIN_REGEX, Usuario } from '../models/Usuario';
import { firmarToken, requireAuth } from '../middleware/auth';

const router = Router();

// Un PIN de 4 dígitos se adivina rápido por fuerza bruta: limitamos los intentos.
const pinLimiter = rateLimit({
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

router.post('/login', pinLimiter, async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Completá usuario y PIN' });

  const u = await Usuario.findOne({ usuario: body.data.usuario }).select('+pinHash +sesionVersion');
  if (!u || !(await u.verificarPin(body.data.pin))) {
    return res.status(401).json({ error: 'Usuario o PIN incorrecto.' });
  }
  if (!u.activo) return res.status(403).json({ error: 'Tu usuario está desactivado. Hablá con el dueño.' });

  const token = firmarToken({ uid: String(u._id), rol: u.rol, sv: u.sesionVersion ?? 0 });
  res.json({ token, usuario: u.toJSON() });
});

router.get('/me', requireAuth, async (req, res) => {
  const u = await Usuario.findById(req.auth!.uid);
  res.json({ usuario: u!.toJSON() });
});

// Cada uno cambia su propio PIN. Cierra las otras sesiones y devuelve un token nuevo para este dispositivo.
const cambiarPinSchema = z.object({
  actual: z.string().trim().min(1, 'Ingresá tu PIN actual'),
  nuevo: z.string().trim().regex(PIN_REGEX, 'El PIN nuevo tiene que tener de 4 a 6 números'),
});

router.post('/cambiar-pin', requireAuth, pinLimiter, async (req, res) => {
  const body = cambiarPinSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });

  const u = await Usuario.findById(req.auth!.uid).select('+pinHash +sesionVersion');
  if (!u || !(await u.verificarPin(body.data.actual))) return res.status(400).json({ error: 'El PIN actual no es correcto' });
  if (body.data.actual === body.data.nuevo) return res.status(400).json({ error: 'El PIN nuevo es igual al actual' });

  u.pinHash = await Usuario.hashPin(body.data.nuevo);
  u.sesionVersion = (u.sesionVersion ?? 0) + 1;
  await u.save();
  res.json({ token: firmarToken({ uid: String(u._id), rol: u.rol, sv: u.sesionVersion }) });
});

export default router;
