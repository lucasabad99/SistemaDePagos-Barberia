import { Schema, model, InferSchemaType, HydratedDocument, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { limpiarJSON } from '../utils/json';

export const ROLES = ['admin', 'barbero'] as const;
export type Rol = (typeof ROLES)[number];

/** PIN: solo números, de 4 a 6 dígitos. */
export const PIN_REGEX = /^\d{4,6}$/;

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    usuario: { type: String, required: true, unique: true, lowercase: true, trim: true },
    pinHash: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, required: true, default: 'barbero' },
    // % que se lleva el barbero por cada servicio. El dueño no cobra comisión.
    comision: { type: Number, min: 0, max: 100, default: 50 },
    activo: { type: Boolean, default: true },
    // Se incrementa al cambiar el PIN o desactivar al usuario: invalida los tokens ya emitidos.
    sesionVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

usuarioSchema.methods.verificarPin = function (pin: string) {
  return bcrypt.compare(pin, this.pinHash);
};

usuarioSchema.statics.hashPin = (pin: string) => bcrypt.hash(pin, 10);

usuarioSchema.set('toJSON', {
  transform: (doc, ret: Record<string, unknown>) => {
    delete ret.pinHash;
    delete ret.sesionVersion;
    return limpiarJSON(doc, ret);
  },
});

export type UsuarioAttrs = InferSchemaType<typeof usuarioSchema>;
type UsuarioMethods = { verificarPin(pin: string): Promise<boolean> };
type UsuarioModel = Model<UsuarioAttrs, {}, UsuarioMethods> & { hashPin(pin: string): Promise<string> };
export type UsuarioDoc = HydratedDocument<UsuarioAttrs, UsuarioMethods>;

export const Usuario = model<UsuarioAttrs, UsuarioModel>('Usuario', usuarioSchema);
