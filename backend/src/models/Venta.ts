import { Schema, model, InferSchemaType, Types } from 'mongoose';
import { limpiarJSON } from '../utils/json';

export const METODOS = ['efectivo', 'transferencia'] as const;

// Ciclo de vida de un papelito:
//   efectivo:       en_barbero → entregado (el dueño recibió la plata)
//                   (si lo cobra el dueño, nace "entregado")
//   transferencia:  pendiente → verificado (el dueño la vio en el banco)
//   cualquiera:     → anulada (error de carga; devuelve el stock)
export const ESTADOS = ['en_barbero', 'entregado', 'pendiente', 'verificado', 'anulada'] as const;
export type Estado = (typeof ESTADOS)[number];

const itemSchema = new Schema(
  {
    tipo: { type: String, enum: ['servicio', 'producto'], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    nombre: { type: String, required: true },
    precio: { type: Number, required: true, min: 0 }, // precio unitario al momento de la venta
    cant: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const ventaSchema = new Schema(
  {
    num: { type: Number, required: true, unique: true },
    fecha: { type: Date, required: true, default: Date.now },
    barbero: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    creadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    items: { type: [itemSchema], validate: (v: unknown[]) => v.length > 0 },
    metodo: { type: String, enum: METODOS, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    recargo: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 }, // lo que pagó el cliente (subtotal + recargo)
    comision: { type: Number, default: 0, min: 0 }, // lo que gana el barbero por esta venta
    estado: { type: String, enum: ESTADOS, required: true },
    entregadoEn: { type: Date, default: null },
    recibidoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    verificadoEn: { type: Date, default: null },
    anuladaEn: { type: Date, default: null },
    motivoAnulacion: { type: String, default: null },
  },
  { timestamps: true },
);
ventaSchema.index({ fecha: -1 });
ventaSchema.index({ barbero: 1, fecha: -1 });
ventaSchema.index({ estado: 1, metodo: 1 });
ventaSchema.set('toJSON', { transform: limpiarJSON });

export type VentaAttrs = InferSchemaType<typeof ventaSchema> & { _id: Types.ObjectId };
export const Venta = model('Venta', ventaSchema);
