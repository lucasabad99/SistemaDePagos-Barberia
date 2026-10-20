import { Router } from 'express';
import { requireAuth, requireRol } from '../middleware/auth';
import { Usuario } from '../models/Usuario';

const router = Router();

router.get('/', requireAuth, requireRol('admin'), async (_req, res) => {
  const usuarios = await Usuario.find().sort({ rol: 1, nombre: 1 });
  res.json({ usuarios });
});

export default router;
