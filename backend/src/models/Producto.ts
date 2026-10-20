import { Schema, model, InferSchemaType } from 'mongoose';
import { limpiarJSON } from '../utils/json';

const productoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
    precio: { type: Number, required: true, min: 0 },
    costo: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    min: { type: Number, default: 0, min: 0 }, // stock mínimo antes de avisar "reponer"
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productoSchema.set('toJSON', { transform: limpiarJSON });

export type ProductoAttrs = InferSchemaType<typeof productoSchema>;
export const Producto = model('Producto', productoSchema);
