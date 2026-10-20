import { Schema, model, InferSchemaType, HydratedDocument, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'barbero'] as const;
export type Rol = (typeof ROLES)[number];

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    usuario: { type: String, required: true, unique: true, lowercase: true, trim: true },
    pinHash: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, required: true, default: 'barbero' },
    // % que se lleva el barbero por cada servicio. El dueño no cobra comisión.
    comision: { type: Number, min: 0, max: 100, default: 50 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

usuarioSchema.methods.verificarPin = function (pin: string) {
  return bcrypt.compare(pin, this.pinHash);
};

usuarioSchema.statics.hashPin = (pin: string) => bcrypt.hash(pin, 10);

usuarioSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.pinHash;
    return ret;
  },
});

export type UsuarioAttrs = InferSchemaType<typeof usuarioSchema>;
type UsuarioMethods = { verificarPin(pin: string): Promise<boolean> };
type UsuarioModel = Model<UsuarioAttrs, {}, UsuarioMethods> & { hashPin(pin: string): Promise<string> };
export type UsuarioDoc = HydratedDocument<UsuarioAttrs, UsuarioMethods>;

export const Usuario = model<UsuarioAttrs, UsuarioModel>('Usuario', usuarioSchema);
