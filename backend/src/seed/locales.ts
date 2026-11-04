// Prepara los locales al arrancar el servidor (en todos los entornos). Es idempotente.
// - Si no hay locales, crea los de la barbería.
// - A lo que existía antes de que hubiera locales (barberos, papelitos, pagos, stock) le asigna uno.
import { Types } from 'mongoose';
import { Local } from '../models/Local';
import { Usuario } from '../models/Usuario';
import { Venta } from '../models/Venta';
import { Pago } from '../models/Pago';
import { Producto } from '../models/Producto';

export const LOCALES_INICIALES = ['Acuña', 'Almagro'];

export async function prepararLocales(opts: { usuariosPorLocal?: Record<string, string>; copiarStock?: boolean } = {}) {
  if (!(await Local.exists({}))) {
    await Local.insertMany(LOCALES_INICIALES.map((nombre, i) => ({ nombre, orden: i + 1 })));
    console.log(`Locales creados: ${LOCALES_INICIALES.join(', ')}`);
  }
  const locales = await Local.find().sort({ orden: 1, nombre: 1 });
  const primero = locales[0]._id;
  const porNombre = new Map(locales.map((l) => [l.nombre, l._id]));

  // Barberos sin local: los de ejemplo a su local; el resto, al primero.
  let asignados = 0;
  for (const [usuario, nombreLocal] of Object.entries(opts.usuariosPorLocal ?? {})) {
    const id = porNombre.get(nombreLocal);
    if (id) asignados += (await Usuario.updateOne({ usuario, rol: 'barbero', local: null }, { $set: { local: id } })).modifiedCount;
  }
  asignados += (await Usuario.updateMany({ rol: 'barbero', local: null }, { $set: { local: primero } })).modifiedCount;

  // Papelitos y pagos viejos: al local de su barbero.
  const sinLocalFiltro = { $or: [{ local: { $exists: false } }, { local: null }] };
  const barberos = await Usuario.find().select('local rol');
  let ventas = 0;
  let pagos = 0;
  for (const b of barberos) {
    const local: Types.ObjectId = b.rol === 'admin' || !b.local ? primero : b.local;
    ventas += (await Venta.updateMany({ ...sinLocalFiltro, barbero: b._id }, { $set: { local } })).modifiedCount;
    pagos += (await Pago.updateMany({ ...sinLocalFiltro, barbero: b._id }, { $set: { local } })).modifiedCount;
  }

  // Stock viejo (un solo número) → stock por local. Va directo a la colección: el campo ya no está en el esquema.
  const viejos = await Producto.collection.find({ stock: { $exists: true } }).toArray();
  for (const p of viejos) {
    const stockLocal = Object.fromEntries(
      locales.map((l) => [String(l._id), l._id.equals(primero) || opts.copiarStock ? (p.stock as number) : 0]),
    );
    await Producto.collection.updateOne({ _id: p._id }, { $set: { stockLocal }, $unset: { stock: '' } });
  }

  if (asignados || ventas || pagos || viejos.length) {
    console.log(`Locales: ${asignados} barberos, ${ventas} papelitos, ${pagos} pagos y ${viejos.length} productos asignados`);
  }
}
