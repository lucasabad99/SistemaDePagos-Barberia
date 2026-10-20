import { Schema, model, InferSchemaType } from 'mongoose';
import { limpiarJSON } from '../utils/json';

const servicioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
    precio: { type: Number, required: true, min: 0 },
    orden: { type: Number, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
servicioSchema.set('toJSON', { transform: limpiarJSON });

export type ServicioAttrs = InferSchemaType<typeof servicioSchema>;
export const Servicio = model('Servicio', servicioSchema);
