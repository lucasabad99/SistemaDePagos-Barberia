import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRol } from '../middleware/auth';
import { Local } from '../models/Local';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const locales = await Local.find({ activo: true }).sort({ orden: 1, nombre: 1 });
  res.json({ locales });
});

// Renombrar un local (el dueño).
router.patch('/:id', requireRol('admin'), async (req, res) => {
  const body = z.object({ nombre: z.string().trim().min(2, 'El nombre es muy corto').max(40) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  try {
    const local = await Local.findByIdAndUpdate(req.params.id, { $set: { nombre: body.data.nombre } }, { returnDocument: 'after' });
    if (!local) return res.status(404).json({ error: 'No existe ese local' });
    res.json({ local });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return res.status(409).json({ error: 'Ya hay un local con ese nombre' });
    throw err;
  }
});

export default router;
