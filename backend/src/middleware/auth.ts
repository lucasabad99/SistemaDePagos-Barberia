import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Types } from 'mongoose';
import { Usuario, type Rol } from '../models/Usuario';
import { Local } from '../models/Local';

export interface AuthPayload {
  uid: string;
  rol: Rol;
  /** sesionVersion del usuario al emitir el token */
  sv: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      /** Local de trabajo del pedido (ver requireLocal) */
      local?: Types.ObjectId;
    }
  }
}

export function firmarToken(payload: AuthPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

/**
 * Valida el token y además consulta al usuario en la base, para que un usuario desactivado
 * o con el PIN cambiado pierda el acceso en el momento (no recién cuando vence el token).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    return res.status(401).json({ error: 'Sesión vencida o inválida' });
  }

  const u = await Usuario.findById(payload.uid).select('rol activo local +sesionVersion');
  if (!u || !u.activo || (u.sesionVersion ?? 0) !== payload.sv) {
    return res.status(401).json({ error: 'Tu sesión se cerró. Volvé a entrar.' });
  }
  req.auth = { uid: payload.uid, rol: u.rol, sv: payload.sv };
  if (u.rol !== 'admin' && u.local) req.local = u.local;
  next();
}

/**
 * Define el local del pedido (va después de requireAuth).
 * - Barbero: siempre su propio local, pida lo que pida.
 * - Dueño: el local que eligió en la app, que viaja en el encabezado X-Local.
 */
export async function requireLocal(req: Request, res: Response, next: NextFunction) {
  if (req.auth!.rol !== 'admin') {
    if (!req.local) return res.status(400).json({ error: 'No tenés un local asignado. Hablá con el dueño.' });
    return next();
  }
  const id = req.header('x-local');
  const local = id && Types.ObjectId.isValid(id) ? await Local.exists({ _id: id, activo: true }) : null;
  if (!local) return res.status(400).json({ error: 'Elegí un local', codigo: 'ELEGIR_LOCAL' });
  req.local = local._id;
  next();
}

export const requireRol =
  (...roles: Rol[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.rol)) return res.status(403).json({ error: 'Sin permiso' });
    next();
  };
