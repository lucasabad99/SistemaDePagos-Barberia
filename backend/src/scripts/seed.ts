// Carga usuarios de ejemplo. Solo para local/staging: se niega a correr en producción.
import mongoose from 'mongoose';
import { env } from '../config/env';
import { connectDB } from '../config/db';
import { Usuario } from '../models/Usuario';
import { Servicio } from '../models/Servicio';
import { Producto } from '../models/Producto';
import { Config } from '../models/Config';

const usuarios = [
  { nombre: 'Darwin', usuario: 'darwin', pin: '1234', rol: 'admin', comision: 0 },
  { nombre: 'Matías', usuario: 'matias', pin: '1111', rol: 'barbero', comision: 50 },
  { nombre: 'Nico', usuario: 'nico', pin: '2222', rol: 'barbero', comision: 50 },
  { nombre: 'Leo', usuario: 'leo', pin: '3333', rol: 'barbero', comision: 45 },
] as const;

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

async function seed() {
  if (env.NODE_ENV === 'production') throw new Error('El seed no se corre en producción.');
  await connectDB();
  for (const { pin, ...u } of usuarios) {
    await Usuario.updateOne(
      { usuario: u.usuario },
      { $set: { ...u, pinHash: await Usuario.hashPin(pin), activo: true } },
      { upsert: true },
    );
    console.log(`  ✓ ${u.nombre} (${u.rol}) — usuario "${u.usuario}", PIN ${pin}`);
  }

  for (const s of servicios) await Servicio.updateOne({ nombre: s.nombre }, { $set: s }, { upsert: true });
  console.log(`  ✓ ${servicios.length} servicios`);
  // El stock solo se setea al crear el producto, para no pisar el stock real en staging.
  for (const { stock, ...p } of productos)
    await Producto.updateOne({ nombre: p.nombre }, { $set: p, $setOnInsert: { stock } }, { upsert: true });
  console.log(`  ✓ ${productos.length} productos`);
  await Config.updateOne({ clave: 'general' }, { $set: config }, { upsert: true });
  console.log(`  ✓ configuración (${config.negocio})`);
  console.log('Seed listo.');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
