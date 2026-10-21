// `npm run seed`: carga los datos de ejemplo en la base de MONGODB_URI. Se niega a correr en producción.
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { cargarDatosEjemplo } from '../seed/datosEjemplo';

connectDB()
  .then(cargarDatosEjemplo)
  .then(() => console.log('Seed listo.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
