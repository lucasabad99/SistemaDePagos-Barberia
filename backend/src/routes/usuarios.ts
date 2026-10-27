import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRol } from '../middleware/auth';
import { PIN_REGEX, Usuario } from '../models/Usuario';

const router = Router();
router.use(requireAuth, requireRol('admin'));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'id inválido');
const nombre = z.string().trim().min(2, 'El nombre es muy corto').max(40);
const usuario = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,20}$/, 'El usuario tiene que tener de 3 a 20 letras o números, sin espacios');
const pin = z.string().trim().regex(PIN_REGEX, 'El PIN tiene que tener de 4 a 6 números');
const comision = z.number().int().min(0).max(100);

const esDuplicado = (err: unknown) => (err as { code?: number })?.code === 11000;
const YA_EXISTE = { error: 'Ese usuario ya existe. Elegí otro.' };

router.get('/', async (_req, res) => {
  const usuarios = await Usuario.find().sort({ rol: 1, activo: -1, nombre: 1 });
  res.json({ usuarios });
});

// Alta de barbero. Desde la app solo se crean barberos; el dueño ya existe.
router.post('/', async (req, res) => {
  const body = z.object({ nombre, usuario, pin, comision }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  try {
    const u = await Usuario.create({
      nombre: body.data.nombre,
      usuario: body.data.usuario,
      pinHash: await Usuario.hashPin(body.data.pin),
      rol: 'barbero',
      comision: body.data.comision,
      activo: true,
    });
    res.status(201).json({ usuario: u });
  } catch (err) {
    if (esDuplicado(err)) return res.status(409).json(YA_EXISTE);
    throw err;
  }
});

router.patch('/:id', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const body = z.object({ nombre, usuario, comision, activo: z.boolean() }).partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });

  const u = await Usuario.findById(req.params.id).select('+sesionVersion');
  if (!u) return res.status(404).json({ error: 'No existe ese usuario' });
  const esYo = String(u._id) === req.auth!.uid;
  if (esYo && body.data.activo === false) return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });

  const { activo, ...datos } = body.data;
  Object.assign(u, datos);
  if (activo !== undefined && activo !== u.activo) {
    u.activo = activo;
    if (!activo) u.sesionVersion = (u.sesionVersion ?? 0) + 1; // lo saca de la app en el momento
  }
  try {
    await u.save();
  } catch (err) {
    if (esDuplicado(err)) return res.status(409).json(YA_EXISTE);
    throw err;
  }
  res.json({ usuario: u });
});

// El dueño le pone un PIN nuevo a un barbero (ej: se lo olvidó). Cierra sus sesiones abiertas.
router.post('/:id/pin', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  if (req.params.id === req.auth!.uid) return res.status(400).json({ error: 'Tu propio PIN lo cambiás desde "Cambiar mi PIN"' });
  const body = z.object({ pin }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });

  const r = await Usuario.updateOne(
    { _id: req.params.id },
    { $set: { pinHash: await Usuario.hashPin(body.data.pin) }, $inc: { sesionVersion: 1 } },
  );
  if (!r.matchedCount) return res.status(404).json({ error: 'No existe ese usuario' });
  res.json({ ok: true });
});

export default router;
