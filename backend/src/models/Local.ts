import { Schema, model, InferSchemaType } from 'mongoose';
import { limpiarJSON } from '../utils/json';

// Cada local de la barbería. Los barberos, papelitos, pagos y el stock se separan por local.
const localSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
    orden: { type: Number, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
localSchema.set('toJSON', { transform: limpiarJSON });

export type LocalAttrs = InferSchemaType<typeof localSchema>;
export const Local = model('Local', localSchema, 'locales');
