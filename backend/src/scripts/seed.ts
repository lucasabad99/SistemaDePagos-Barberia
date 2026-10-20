// Carga usuarios de ejemplo. Solo para local/staging: se niega a correr en producción.
import mongoose from 'mongoose';
import { env } from '../config/env';
import { connectDB } from '../config/db';
import { Usuario } from '../models/Usuario';

const usuarios = [
  { nombre: 'Darwin', usuario: 'darwin', pin: '1234', rol: 'admin', comision: 0 },
  { nombre: 'Matías', usuario: 'matias', pin: '1111', rol: 'barbero', comision: 50 },
  { nombre: 'Nico', usuario: 'nico', pin: '2222', rol: 'barbero', comision: 50 },
  { nombre: 'Leo', usuario: 'leo', pin: '3333', rol: 'barbero', comision: 45 },
] as const;

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
  console.log('Seed listo.');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
