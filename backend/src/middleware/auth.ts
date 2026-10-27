import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Usuario, type Rol } from '../models/Usuario';

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

  const u = await Usuario.findById(payload.uid).select('rol activo +sesionVersion');
  if (!u || !u.activo || (u.sesionVersion ?? 0) !== payload.sv) {
    return res.status(401).json({ error: 'Tu sesión se cerró. Volvé a entrar.' });
  }
  req.auth = { uid: payload.uid, rol: u.rol, sv: payload.sv };
  next();
}

export const requireRol =
  (...roles: Rol[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.rol)) return res.status(403).json({ error: 'Sin permiso' });
    next();
  };
