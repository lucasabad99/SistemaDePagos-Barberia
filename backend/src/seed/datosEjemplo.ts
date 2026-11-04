// Datos de ejemplo para local y staging. Nunca se cargan en producción.
import { env } from '../config/env';
import { Usuario } from '../models/Usuario';
import { Servicio } from '../models/Servicio';
import { Producto } from '../models/Producto';
import { Config } from '../models/Config';
import { Local } from '../models/Local';
import { prepararLocales } from './locales';

// En un local trabaja uno solo (Leo, en Acuña) y en el otro los demás (Almagro).
const usuarios = [
  { nombre: 'Darwin', usuario: 'darwin', pin: '1234', rol: 'admin', comision: 0, local: null },
  { nombre: 'Matías', usuario: 'matias', pin: '1111', rol: 'barbero', comision: 50, local: 'Almagro' },
  { nombre: 'Nico', usuario: 'nico', pin: '2222', rol: 'barbero', comision: 50, local: 'Almagro' },
  { nombre: 'Leo', usuario: 'leo', pin: '3333', rol: 'barbero', comision: 45, local: 'Acuña' },
] as const;

/** usuario → nombre del local, para asignar los barberos de ejemplo que ya existían sin local. */
export const localesDemo = Object.fromEntries(usuarios.filter((u) => u.local).map((u) => [u.usuario, u.local!]));

/** Hay datos de ejemplo en este entorno (local o staging). En producción, nunca. */
export const hayDemo = () => env.NODE_ENV !== 'production' && (env.SEED_DEMO || env.NODE_ENV === 'development');

/** Usuarios de ejemplo para los botones de "entrar rápido" del login. */
export const usuariosDemo = () => usuarios.map(({ nombre, usuario, pin, rol, local }) => ({ nombre, usuario, pin, rol, local }));

const servicios = [
  { nombre: 'Corte', precio: 18000, orden: 1 },
  { nombre: 'Barba', precio: 10000, orden: 2 },
  { nombre: 'Corte + barba', precio: 25000, orden: 3 },
];

const productos = [
  { nombre: 'Cera mate', precio: 12000, costo: 6000, stock: 14, min: 5 },
  { nombre: 'Shampoo anticaspa', precio: 15000, costo: 7500, stock: 4, min: 5 },
  { nombre: 'Aceite para barba', precio: 14000, costo: 6500, stock: 9, min: 4 },
  { nombre: 'Pomada brillo', precio: 11000, costo: 5000, stock: 3, min: 4 },
];

const config = { negocio: 'Barbería Darwin', recargoPct: 10, comisionProducto: 10, topeAnual: 120000000 };

/** Crea o actualiza los datos de ejemplo. Es idempotente: se puede correr varias veces. */
export async function cargarDatosEjemplo() {
  if (env.NODE_ENV === 'production') throw new Error('Los datos de ejemplo no se cargan en producción.');

  await prepararLocales();
  const locales = await Local.find();
  const idLocal = new Map(locales.map((l) => [l.nombre, l._id]));

  for (const { pin, local, ...u } of usuarios) {
    await Usuario.updateOne(
      { usuario: u.usuario },
      // Resetea el PIN, así que también cierra las sesiones abiertas de ese usuario.
      {
        $set: { ...u, local: local ? (idLocal.get(local) ?? null) : null, pinHash: await Usuario.hashPin(pin), activo: true },
        $inc: { sesionVersion: 1 },
      },
      { upsert: true },
    );
    console.log(`  ✓ ${u.nombre} (${u.rol}${local ? `, ${local}` : ''}) — usuario "${u.usuario}", PIN ${pin}`);
  }

  for (const s of servicios) await Servicio.updateOne({ nombre: s.nombre }, { $set: s }, { upsert: true });
  console.log(`  ✓ ${servicios.length} servicios`);
  // El stock solo se setea al crear el producto, para no pisar el stock real en staging. Cada local arranca con el mismo.
  for (const { stock, ...p } of productos) {
    const stockLocal = Object.fromEntries(locales.map((l) => [String(l._id), stock]));
    await Producto.updateOne({ nombre: p.nombre }, { $set: p, $setOnInsert: { stockLocal } }, { upsert: true });
  }
  console.log(`  ✓ ${productos.length} productos`);
  await Config.updateOne({ clave: 'general' }, { $set: config }, { upsert: true });
  console.log(`  ✓ configuración (${config.negocio})`);
}

/**
 * Al arrancar el servidor: si SEED_DEMO está activo y la base no tiene usuarios, carga los ejemplos.
 * Sirve para staging, donde no hay consola para correr `npm run seed`.
 */
export async function sembrarSiVacia() {
  if (!env.SEED_DEMO || env.NODE_ENV === 'production') return;
  if (await Usuario.exists({})) return;
  console.log('Base vacía y SEED_DEMO activo: cargando datos de ejemplo…');
  await cargarDatosEjemplo();
}
