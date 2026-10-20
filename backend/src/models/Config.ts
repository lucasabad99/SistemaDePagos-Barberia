import { Schema, model } from 'mongoose';

// Documento único con la configuración del negocio.
const configSchema = new Schema(
  {
    clave: { type: String, default: 'general', unique: true },
    negocio: { type: String, default: 'Mi Barbería' },
    recargoPct: { type: Number, default: 10, min: 0, max: 100 }, // recargo por transferencia
    comisionProducto: { type: Number, default: 10, min: 0, max: 100 }, // % para el barbero por producto vendido
    topeAnual: { type: Number, default: 0, min: 0 }, // tope de facturación de la categoría (impuestos)
  },
  { timestamps: true },
);
configSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret._id;
    delete ret.__v;
    delete ret.clave;
    return ret;
  },
});

export const Config = model('Config', configSchema);

export async function getConfig() {
  return Config.findOneAndUpdate({ clave: 'general' }, {}, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
}
