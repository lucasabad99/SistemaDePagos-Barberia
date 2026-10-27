import { Schema, model, InferSchemaType } from 'mongoose';
import { limpiarJSON } from '../utils/json';

// Pago de comisiones del dueño a un barbero por un período (una semana, de lunes a domingo).
// Puede haber más de un pago por semana: si se pagó el sábado y el barbero trabajó el domingo,
// la diferencia queda como saldo y se paga aparte.
const pagoSchema = new Schema(
  {
    barbero: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    desde: { type: Date, required: true }, // inicio del período (inclusive)
    hasta: { type: Date, required: true }, // fin del período (exclusive)
    monto: { type: Number, required: true, min: 0 },
    servicios: { type: Number, default: 0 }, // servicios del período al momento de pagar (referencia)
    fecha: { type: Date, required: true, default: Date.now },
    pagadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
  { timestamps: true },
);
pagoSchema.index({ barbero: 1, desde: 1 });
pagoSchema.set('toJSON', { transform: limpiarJSON });

export type PagoAttrs = InferSchemaType<typeof pagoSchema>;
export const Pago = model('Pago', pagoSchema);
