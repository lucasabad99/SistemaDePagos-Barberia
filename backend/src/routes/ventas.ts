import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRol } from '../middleware/auth';
import { Venta, ESTADOS, METODOS, Estado } from '../models/Venta';
import { Usuario } from '../models/Usuario';
import { Servicio } from '../models/Servicio';
import { Producto } from '../models/Producto';
import { getConfig } from '../models/Config';
import { siguienteNumero } from '../models/Contador';
import { env } from '../config/env';

const router = Router();
router.use(requireAuth);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'id inválido');
const BARBERO_POP = { path: 'barbero', select: 'nombre rol' };

/* ---------- Anotar un papelito ---------- */
const nuevaVentaSchema = z
  .object({
    barberoId: objectId.optional(), // solo lo usa el admin; el barbero siempre anota a su nombre
    servicioId: objectId.optional(),
    productos: z.array(z.object({ id: objectId, cant: z.number().int().min(1).max(50) })).max(20).default([]),
    metodo: z.enum(METODOS),
    comprobanteVisto: z.boolean().optional(),
  })
  .refine((v) => v.servicioId || v.productos.length, { message: 'Elegí un servicio o un producto' })
  .refine((v) => v.metodo !== 'transferencia' || v.comprobanteVisto, { message: 'Confirmá que viste el comprobante' });

router.post('/', async (req, res) => {
  const parsed = nuevaVentaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const body = parsed.data;
  const esAdmin = req.auth!.rol === 'admin';

  const barberoId = esAdmin && body.barberoId ? body.barberoId : req.auth!.uid;
  const barbero = await Usuario.findById(barberoId);
  if (!barbero || !barbero.activo) return res.status(400).json({ error: 'Barbero no válido' });

  const config = await getConfig();
  const items: { tipo: 'servicio' | 'producto'; refId: Types.ObjectId; nombre: string; precio: number; cant: number }[] = [];

  if (body.servicioId) {
    const s = await Servicio.findOne({ _id: body.servicioId, activo: true });
    if (!s) return res.status(400).json({ error: 'Servicio no disponible' });
    items.push({ tipo: 'servicio', refId: s._id, nombre: s.nombre, precio: s.precio, cant: 1 });
  }

  // Descuenta stock de forma condicional (stock >= cant). Si alguno falla, devuelve lo ya descontado.
  const descontados: { id: Types.ObjectId; cant: number }[] = [];
  const devolverStock = () =>
    Promise.all(descontados.map((d) => Producto.updateOne({ _id: d.id }, { $inc: { stock: d.cant } })));
  for (const { id, cant } of body.productos) {
    const p = await Producto.findOneAndUpdate(
      { _id: id, activo: true, stock: { $gte: cant } },
      { $inc: { stock: -cant } },
      { returnDocument: 'after' },
    );
    if (!p) {
      await devolverStock();
      const existe = await Producto.findById(id);
      return res.status(409).json({ error: existe ? `No hay stock suficiente de ${existe.nombre}` : 'Producto no disponible' });
    }
    descontados.push({ id: p._id, cant });
    items.push({ tipo: 'producto', refId: p._id, nombre: p.nombre, precio: p.precio, cant });
  }

  const subtotal = items.reduce((s, x) => s + x.precio * x.cant, 0);
  const recargo = body.metodo === 'transferencia' ? Math.round((subtotal * config.recargoPct) / 100) : 0;
  const servicios = items.filter((x) => x.tipo === 'servicio').reduce((s, x) => s + x.precio * x.cant, 0);
  const productos = subtotal - servicios;
  const comision =
    barbero.rol === 'admin'
      ? 0
      : Math.round((servicios * (barbero.comision ?? 0)) / 100 + (productos * config.comisionProducto) / 100);

  // Si cobra el dueño (o anota la venta él), la plata ya está en la caja.
  const cobraElDueño = esAdmin || barbero.rol === 'admin';
  const ahora = new Date();
  const estado: Estado = body.metodo === 'transferencia' ? 'pendiente' : cobraElDueño ? 'entregado' : 'en_barbero';

  try {
    const venta = await Venta.create({
      num: await siguienteNumero('venta'),
      fecha: ahora,
      barbero: barbero._id,
      creadoPor: req.auth!.uid,
      items,
      metodo: body.metodo,
      subtotal,
      recargo,
      total: subtotal + recargo,
      comision,
      estado,
      entregadoEn: estado === 'entregado' ? ahora : null,
      recibidoPor: estado === 'entregado' ? req.auth!.uid : null,
    });
    await venta.populate(BARBERO_POP);
    res.status(201).json({ venta });
  } catch (err) {
    await devolverStock();
    throw err;
  }
});

/* ---------- Listar ---------- */
const listarSchema = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  barberoId: objectId.optional(),
  estado: z.enum(ESTADOS).optional(),
});

router.get('/', async (req, res) => {
  const parsed = listarSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Filtros inválidos' });
  const q = parsed.data;
  if (!q.desde && !q.estado) return res.status(400).json({ error: 'Indicá un rango de fechas o un estado' });

  const filtro: Record<string, unknown> = {};
  if (q.desde || q.hasta) filtro.fecha = { ...(q.desde && { $gte: q.desde }), ...(q.hasta && { $lt: q.hasta }) };
  if (q.estado) filtro.estado = q.estado;
  // El barbero solo ve sus propios papelitos, pida lo que pida.
  if (req.auth!.rol !== 'admin') filtro.barbero = req.auth!.uid;
  else if (q.barberoId) filtro.barbero = q.barberoId;

  const ventas = await Venta.find(filtro).sort({ fecha: -1 }).limit(1000).populate(BARBERO_POP);
  res.json({ ventas });
});

/* ---------- Efectivo que todavía tienen los barberos ---------- */
router.get('/en-mano', async (req, res) => {
  const match: Record<string, unknown> = { metodo: 'efectivo', estado: 'en_barbero' };
  if (req.auth!.rol !== 'admin') match.barbero = new Types.ObjectId(req.auth!.uid);
  const filas = await Venta.aggregate<{ _id: Types.ObjectId; cantidad: number; total: number }>([
    { $match: match },
    { $group: { _id: '$barbero', cantidad: { $sum: 1 }, total: { $sum: '$total' } } },
  ]);
  res.json({ enMano: filas.map((f) => ({ barberoId: String(f._id), cantidad: f.cantidad, total: f.total })) });
});

/* ---------- Calendario: totales por día ---------- */
const calendarioSchema = z
  .object({ desde: z.coerce.date(), hasta: z.coerce.date() })
  .refine((p) => p.hasta > p.desde && +p.hasta - +p.desde <= 45 * 864e5, { message: 'Rango inválido' });

router.get('/calendario', async (req, res) => {
  const q = calendarioSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'Rango inválido' });
  const match: Record<string, unknown> = { fecha: { $gte: q.data.desde, $lt: q.data.hasta }, estado: { $ne: 'anulada' } };
  if (req.auth!.rol !== 'admin') match.barbero = new Types.ObjectId(req.auth!.uid);

  const dias = await Venta.aggregate<{ _id: string; papelitos: number; servicios: number; total: number; comision: number; pendientes: number }>([
    { $match: match },
    {
      $group: {
        // El día se calcula en la hora del negocio, no en UTC (un corte a las 22 h no puede caer al día siguiente).
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: env.TZ_NEGOCIO } },
        papelitos: { $sum: 1 },
        servicios: { $sum: { $size: { $filter: { input: '$items', cond: { $eq: ['$$this.tipo', 'servicio'] } } } } },
        total: { $sum: '$total' },
        comision: { $sum: '$comision' },
        pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json({ dias: dias.map(({ _id, ...d }) => ({ dia: _id, ...d })) });
});

/* ---------- Acciones del dueño ---------- */
// El barbero le entrega al dueño el efectivo de sus papelitos.
router.post('/recibir', requireRol('admin'), async (req, res) => {
  const parsed = z.object({ barberoId: objectId }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Falta el barbero' });
  const pendientes = await Venta.find({ barbero: parsed.data.barberoId, metodo: 'efectivo', estado: 'en_barbero' }).select('_id total');
  if (!pendientes.length) return res.json({ cantidad: 0, total: 0 });
  const r = await Venta.updateMany(
    { _id: { $in: pendientes.map((v) => v._id) }, estado: 'en_barbero' },
    { $set: { estado: 'entregado', entregadoEn: new Date(), recibidoPor: req.auth!.uid } },
  );
  res.json({ cantidad: r.modifiedCount, total: pendientes.reduce((s, v) => s + v.total, 0) });
});

// El dueño vio la transferencia acreditada en su cuenta.
router.post('/:id/verificar', requireRol('admin'), async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const venta = await Venta.findOneAndUpdate(
    { _id: req.params.id, metodo: 'transferencia', estado: 'pendiente' },
    { $set: { estado: 'verificado', verificadoEn: new Date() } },
    { returnDocument: 'after' },
  ).populate(BARBERO_POP);
  if (!venta) return res.status(409).json({ error: 'La transferencia ya estaba confirmada o no existe' });
  res.json({ venta });
});

// Corrige un error de carga: el papelito queda registrado como anulado y el stock vuelve.
router.post('/:id/anular', requireRol('admin'), async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const motivo = z.string().trim().max(200).optional().safeParse(req.body?.motivo);
  const venta = await Venta.findOneAndUpdate(
    { _id: req.params.id, estado: { $ne: 'anulada' } },
    { $set: { estado: 'anulada', anuladaEn: new Date(), motivoAnulacion: motivo.success ? motivo.data || null : null } },
    { returnDocument: 'after' },
  ).populate(BARBERO_POP);
  if (!venta) return res.status(409).json({ error: 'El papelito ya estaba anulado o no existe' });
  await Promise.all(
    venta.items.filter((x) => x.tipo === 'producto').map((x) => Producto.updateOne({ _id: x.refId }, { $inc: { stock: x.cant } })),
  );
  res.json({ venta });
});

export default router;
