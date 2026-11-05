import { Schema, model, InferSchemaType } from 'mongoose';
import { limpiarJSON } from '../utils/json';

// Plata recibida en la cuenta de Mercado Pago del dueño (copia de lo que devuelve su API).
// Cada cobro se puede usar para confirmar un solo papelito.
export const MEDIOS_MP = ['mercadopago', 'banco', 'debin', 'otro'] as const;

const cobroSchema = new Schema(
  {
    mpId: { type: String, required: true, unique: true },
    fecha: { type: Date, required: true },
    monto: { type: Number, required: true },
    pagador: { type: String, default: null }, // "Juan P." (como lo informa Mercado Pago)
    medio: { type: String, enum: MEDIOS_MP, default: 'otro' },
    venta: { type: Schema.Types.ObjectId, ref: 'Venta', default: null },
    asignadoEn: { type: Date, default: null },
  },
  { timestamps: true },
);
cobroSchema.index({ venta: 1, fecha: -1 });
cobroSchema.set('toJSON', { transform: limpiarJSON });

export type CobroMPAttrs = InferSchemaType<typeof cobroSchema>;
export const CobroMP = model('CobroMP', cobroSchema, 'cobros_mp');
