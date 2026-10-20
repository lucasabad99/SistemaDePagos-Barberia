import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Servicio } from '../models/Servicio';
import { Producto } from '../models/Producto';
import { getConfig } from '../models/Config';

const router = Router();

// Lo que necesita la pantalla de "Anotar corte": servicios, productos y recargo.
router.get('/', requireAuth, async (_req, res) => {
  const [servicios, productos, config] = await Promise.all([
    Servicio.find({ activo: true }).sort({ orden: 1, nombre: 1 }),
    Producto.find({ activo: true }).sort({ nombre: 1 }),
    getConfig(),
  ]);
  res.json({ servicios, productos, config });
});

export default router;
