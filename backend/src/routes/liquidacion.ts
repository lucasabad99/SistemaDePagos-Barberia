import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRol } from '../middleware/auth';
import { Venta } from '../models/Venta';
import { Usuario } from '../models/Usuario';
import { Pago } from '../models/Pago';

// Liquidación de comisiones por período: cuánto le corresponde a cada barbero,
// cuánto ya se le pagó y cuánto falta. Es la misma cuenta para el dueño y para el barbero.
const router = Router();
router.use(requireAuth);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'id inválido');
const DIA = 864e5;
const periodo = z
  .object({ desde: z.coerce.date(), hasta: z.coerce.date() })
  .refine((p) => p.hasta > p.desde && +p.hasta - +p.desde <= 31 * DIA, { message: 'Período inválido' });

interface Liquidacion {
  barbero: { id: string; nombre: string; activo: boolean };
  papelitos: number;
  servicios: { nombre: string; cant: number }[];
  productos: number;
  comision: number;
  pagado: number;
  saldo: number;
  enMano: { cantidad: number; total: number };
  pagos: unknown[];
}

async function liquidar(desde: Date, hasta: Date, soloBarbero?: string): Promise<Liquidacion[]> {
  const filtroBarbero = soloBarbero ? { barbero: new Types.ObjectId(soloBarbero) } : {};

  const [ventas, pagos, enMano] = await Promise.all([
    Venta.find({ ...filtroBarbero, fecha: { $gte: desde, $lt: hasta }, estado: { $ne: 'anulada' } }).select('barbero items comision'),
    Pago.find({ ...filtroBarbero, desde: { $gte: desde }, hasta: { $lte: hasta } }).sort({ fecha: 1 }),
    // El efectivo sin entregar se cuenta entero (no solo el del período): hay que entregarlo antes de cobrar.
    Venta.aggregate<{ _id: Types.ObjectId; cantidad: number; total: number }>([
      { $match: { ...filtroBarbero, metodo: 'efectivo', estado: 'en_barbero' } },
      { $group: { _id: '$barbero', cantidad: { $sum: 1 }, total: { $sum: '$total' } } },
    ]),
  ]);

  // Barberos a mostrar: los activos, más cualquiera que tenga movimientos en el período.
  const ids = new Set([...ventas.map((v) => String(v.barbero)), ...pagos.map((p) => String(p.barbero))]);
  const usuarios = await Usuario.find(
    soloBarbero ? { _id: soloBarbero } : { rol: 'barbero', $or: [{ activo: true }, { _id: { $in: [...ids] } }] },
  ).sort({ nombre: 1 });

  return usuarios.map((u) => {
    const id = String(u._id);
    const vs = ventas.filter((v) => String(v.barbero) === id);
    const ps = pagos.filter((p) => String(p.barbero) === id);
    const porServicio = new Map<string, number>();
    let productos = 0;
    for (const v of vs)
      for (const x of v.items) {
        if (x.tipo === 'servicio') porServicio.set(x.nombre, (porServicio.get(x.nombre) ?? 0) + x.cant);
        else productos += x.cant;
      }
    const comision = vs.reduce((s, v) => s + (v.comision ?? 0), 0);
    const pagado = ps.reduce((s, p) => s + p.monto, 0);
    const m = enMano.find((e) => String(e._id) === id);
    return {
      barbero: { id, nombre: u.nombre, activo: u.activo },
      papelitos: vs.length,
      servicios: [...porServicio].map(([nombre, cant]) => ({ nombre, cant })),
      productos,
      comision,
      pagado,
      saldo: comision - pagado,
      enMano: { cantidad: m?.cantidad ?? 0, total: m?.total ?? 0 },
      pagos: ps.map((p) => p.toJSON()),
    };
  });
}

router.get('/', async (req, res) => {
  const p = periodo.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: 'Período inválido' });
  // El barbero solo ve su propia liquidación.
  const solo = req.auth!.rol === 'admin' ? undefined : req.auth!.uid;
  const barberos = await liquidar(p.data.desde, p.data.hasta, solo);
  res.json({ barberos, total: barberos.reduce((s, b) => s + Math.max(0, b.saldo), 0) });
});

// El dueño registra que le pagó a un barbero el saldo del período.
router.post('/pagar', requireRol('admin'), async (req, res) => {
  const body = periodo.and(z.object({ barberoId: objectId })).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { desde, hasta, barberoId } = body.data;

  const [liq] = await liquidar(desde, hasta, barberoId);
  if (!liq) return res.status(404).json({ error: 'No existe ese barbero' });
  if (liq.enMano.total > 0) {
    return res.status(409).json({
      error: `Primero ${liq.barbero.nombre} tiene que entregarte $${liq.enMano.total.toLocaleString('es-AR')} en efectivo`,
    });
  }
  if (liq.saldo <= 0) return res.status(409).json({ error: 'No hay nada pendiente de pago en este período' });

  const pago = await Pago.create({
    barbero: barberoId,
    desde,
    hasta,
    monto: liq.saldo,
    servicios: liq.servicios.reduce((s, x) => s + x.cant, 0),
    pagadoPor: req.auth!.uid,
  });
  res.status(201).json({ pago });
});

// Historial de pagos (para "Pagos que recibiste" del barbero).
router.get('/pagos', async (req, res) => {
  const filtro = req.auth!.rol === 'admin' ? {} : { barbero: req.auth!.uid };
  const pagos = await Pago.find(filtro).sort({ fecha: -1 }).limit(30).populate({ path: 'barbero', select: 'nombre' });
  res.json({ pagos });
});

export default router;
