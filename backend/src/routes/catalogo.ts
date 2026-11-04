import { Router } from 'express';
import { requireAuth, requireLocal } from '../middleware/auth';
import { Servicio } from '../models/Servicio';
import { Producto } from '../models/Producto';
import { getConfig } from '../models/Config';

const router = Router();

// Lo que necesita la pantalla de "Anotar corte": servicios, productos (con el stock de este local) y recargo.
router.get('/', requireAuth, requireLocal, async (req, res) => {
  const [servicios, productos, config] = await Promise.all([
    Servicio.find({ activo: true }).sort({ orden: 1, nombre: 1 }),
    Producto.find({ activo: true }).sort({ nombre: 1 }),
    getConfig(),
  ]);
  const local = String(req.local);
  res.json({
    servicios,
    productos: productos.map((p) => {
      const { stockLocal: _, ...resto } = p.toJSON() as Record<string, unknown>;
      return { ...resto, stock: p.stockLocal?.get(local) ?? 0 };
    }),
    config,
  });
});

export default router;
