import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRol } from '../middleware/auth';
import { Servicio } from '../models/Servicio';

// Servicios y sus precios (solo el dueño). Son los mismos en todos los locales.
// Cambiar un precio vale para los papelitos nuevos: los ya anotados guardan el precio que tenían.
const router = Router();
router.use(requireAuth, requireRol('admin'));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'id inválido');
const datos = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto').max(40),
  precio: z.number().int('Sin centavos').min(0, 'No puede ser negativo').max(10_000_000),
});
const esDuplicado = (err: unknown) => (err as { code?: number })?.code === 11000;
const YA_EXISTE = { error: 'Ya hay un servicio con ese nombre' };

router.get('/', async (_req, res) => {
  res.json({ servicios: await Servicio.find().sort({ activo: -1, orden: 1, nombre: 1 }) });
});

router.post('/', async (req, res) => {
  const body = datos.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  const ultimo = await Servicio.findOne().sort({ orden: -1 }).select('orden');
  try {
    const s = await Servicio.create({ ...body.data, orden: (ultimo?.orden ?? 0) + 1, activo: true });
    res.status(201).json({ servicio: s });
  } catch (err) {
    if (esDuplicado(err)) return res.status(409).json(YA_EXISTE);
    throw err;
  }
});

router.patch('/:id', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const body = datos.extend({ activo: z.boolean() }).partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  if (body.data.activo === false && (await Servicio.countDocuments({ activo: true, _id: { $ne: req.params.id } })) === 0) {
    return res.status(400).json({ error: 'Tiene que quedar al menos un servicio a la venta' });
  }
  try {
    const s = await Servicio.findByIdAndUpdate(req.params.id, { $set: body.data }, { returnDocument: 'after', runValidators: true });
    if (!s) return res.status(404).json({ error: 'No existe ese servicio' });
    res.json({ servicio: s });
  } catch (err) {
    if (esDuplicado(err)) return res.status(409).json(YA_EXISTE);
    throw err;
  }
});

export default router;
