import { Schema, model, InferSchemaType } from 'mongoose';
import { limpiarJSON } from '../utils/json';

// Cada cambio de stock de un producto en un local: lo que entra, las correcciones y lo que se vende.
export const TIPOS_MOVIMIENTO = ['ingreso', 'ajuste', 'venta', 'anulacion'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

const movimientoSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now },
    local: { type: Schema.Types.ObjectId, ref: 'Local', required: true },
    producto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
    tipo: { type: String, enum: TIPOS_MOVIMIENTO, required: true },
    cant: { type: Number, required: true }, // + entra, − sale
    stock: { type: Number, default: null }, // cómo quedó el stock después del movimiento
    costo: { type: Number, default: null }, // costo por unidad (en los ingresos)
    nota: { type: String, trim: true, default: null },
    venta: { type: Schema.Types.ObjectId, ref: 'Venta', default: null },
    num: { type: Number, default: null }, // nº del papelito, para mostrarlo sin buscar la venta
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
);
movimientoSchema.index({ local: 1, producto: 1, fecha: -1 });
movimientoSchema.set('toJSON', { transform: limpiarJSON });

export type MovimientoAttrs = InferSchemaType<typeof movimientoSchema>;
export const MovimientoStock = model('MovimientoStock', movimientoSchema, 'movimientos_stock');
