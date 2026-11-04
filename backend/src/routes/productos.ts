import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireLocal, requireRol } from '../middleware/auth';
import { Producto } from '../models/Producto';
import { Local } from '../models/Local';
import { Venta } from '../models/Venta';
import { MovimientoStock } from '../models/MovimientoStock';

// Inventario (solo el dueño). Los productos y sus precios son los mismos en todos los locales;
// el stock es de cada local y se maneja en el local en el que está parado el dueño.
const router = Router();
router.use(requireAuth, requireRol('admin'), requireLocal);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'id inválido');
const nombre = z.string().trim().min(2, 'El nombre es muy corto').max(50);
const plata = z.number().int('Sin centavos').min(0, 'No puede ser negativo').max(100_000_000);
const unidades = z.number().int('Tiene que ser un número entero').min(0, 'No puede ser negativo').max(100_000);
const nota = z.string().trim().max(200).optional();

const esDuplicado = (err: unknown) => (err as { code?: number })?.code === 11000;
const YA_EXISTE = { error: 'Ya hay un producto con ese nombre' };

type ProductoDoc = InstanceType<typeof Producto>;

// Lo que ve el dueño de cada producto: stock de este local, de los otros, y lo vendido este mes acá.
async function armar(productos: ProductoDoc[], local: Types.ObjectId) {
  const otros = await Local.find({ activo: true, _id: { $ne: local } }).sort({ orden: 1, nombre: 1 });
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const vendidos = await Venta.aggregate<{ _id: Types.ObjectId; cant: number }>([
    { $match: { local, fecha: { $gte: inicioMes }, estado: { $ne: 'anulada' } } },
    { $unwind: '$items' },
    { $match: { 'items.tipo': 'producto', 'items.refId': { $in: productos.map((p) => p._id) } } },
    { $group: { _id: '$items.refId', cant: { $sum: '$items.cant' } } },
  ]);
  const porId = new Map(vendidos.map((v) => [String(v._id), v.cant]));
  return productos.map((p) => {
    const { stockLocal: _, ...resto } = p.toJSON() as Record<string, unknown>;
    return {
      ...resto,
      stock: p.stockLocal?.get(String(local)) ?? 0,
      vendidosMes: porId.get(String(p._id)) ?? 0,
      otrosLocales: otros.map((l) => ({ id: String(l._id), nombre: l.nombre, stock: p.stockLocal?.get(String(l._id)) ?? 0 })),
    };
  });
}

router.get('/', async (req, res) => {
  const productos = await Producto.find().sort({ activo: -1, nombre: 1 });
  res.json({ productos: await armar(productos, req.local!) });
});

// Alta: el producto aparece en todos los locales; el stock inicial es el de este local (los otros arrancan en 0).
router.post('/', async (req, res) => {
  const body = z
    .object({ nombre, precio: plata, costo: plata.default(0), min: unidades.default(0), stock: unidades.default(0) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  const { stock, ...datos } = body.data;
  try {
    const p = await Producto.create({ ...datos, stockLocal: { [String(req.local)]: stock }, activo: true });
    if (stock > 0) {
      await MovimientoStock.create({
        local: req.local,
        producto: p._id,
        tipo: 'ingreso',
        cant: stock,
        stock,
        costo: datos.costo || null,
        nota: 'Stock inicial',
        usuario: req.auth!.uid,
      });
    }
    res.status(201).json({ producto: (await armar([p], req.local!))[0] });
  } catch (err) {
    if (esDuplicado(err)) return res.status(409).json(YA_EXISTE);
    throw err;
  }
});

// Edición y baja/reactivación (activo). Nombre, precio y estado valen para todos los locales.
router.patch('/:id', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const body = z.object({ nombre, precio: plata, costo: plata, min: unidades, activo: z.boolean() }).partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  try {
    const p = await Producto.findByIdAndUpdate(req.params.id, { $set: body.data }, { returnDocument: 'after', runValidators: true });
    if (!p) return res.status(404).json({ error: 'No existe ese producto' });
    res.json({ producto: (await armar([p], req.local!))[0] });
  } catch (err) {
    if (esDuplicado(err)) return res.status(409).json(YA_EXISTE);
    throw err;
  }
});

// Mover stock en este local:
// - ingreso: entró mercadería (suma). Si trae costo, pasa a ser el costo del producto.
// - ajuste: se contó lo que hay y se corrige al número real.
const stockSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ingreso'), cant: unidades.min(1, 'Poné cuántas unidades entraron'), costo: plata.optional(), nota }),
  z.object({ tipo: z.literal('ajuste'), stock: unidades, nota }),
]);

router.post('/:id/stock', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const body = stockSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });
  const key = `stockLocal.${req.local}`;
  const d = body.data;

  let p: ProductoDoc | null;
  let cant: number;
  if (d.tipo === 'ingreso') {
    p = await Producto.findByIdAndUpdate(
      req.params.id,
      { $inc: { [key]: d.cant }, ...(d.costo !== undefined && { $set: { costo: d.costo } }) },
      { returnDocument: 'after' },
    );
    cant = d.cant;
  } else {
    // El valor anterior sale de la misma operación, así la diferencia es exacta aunque justo se venda algo.
    const antes = await Producto.findByIdAndUpdate(req.params.id, { $set: { [key]: d.stock } }, { returnDocument: 'before' });
    p = antes && (await Producto.findById(antes._id));
    cant = d.stock - (antes?.stockLocal?.get(String(req.local)) ?? 0);
  }
  if (!p) return res.status(404).json({ error: 'No existe ese producto' });

  await MovimientoStock.create({
    local: req.local,
    producto: p._id,
    tipo: d.tipo,
    cant,
    stock: p.stockLocal?.get(String(req.local)) ?? 0,
    costo: d.tipo === 'ingreso' ? (d.costo ?? null) : null,
    nota: d.nota || null,
    usuario: req.auth!.uid,
  });
  res.json({ producto: (await armar([p], req.local!))[0] });
});

// Historial de un producto en este local.
router.get('/:id/movimientos', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido' });
  const movimientos = await MovimientoStock.find({ local: req.local, producto: req.params.id })
    .sort({ fecha: -1 })
    .limit(100)
    .populate({ path: 'usuario', select: 'nombre' });
  res.json({ movimientos });
});

export default router;
