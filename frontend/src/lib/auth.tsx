import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, post, tokenStore, Usuario } from './api';

interface AuthCtx {
  usuario: Usuario | null;
  cargando: boolean;
  /** mensaje para mostrar en el login cuando la sesión se cerró sola */
  aviso: string;
  login: (usuario: string, pin: string) => Promise<void>;
  logout: () => void;
  cambiarPin: (actual: string, nuevo: string) => Promise<void>;
  /** para refrescar los datos propios después de editarse (ej: el dueño cambia su nombre) */
  recargarYo: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');

  const recargarYo = () => api<{ usuario: Usuario }>('/auth/me').then((r) => setUsuario(r.usuario));

  useEffect(() => {
    if (!tokenStore.get()) return setCargando(false);
    recargarYo()
      .catch(() => tokenStore.clear())
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUsuario(null);
      setAviso('Tu sesión se cerró. Volvé a entrar.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (u: string, pin: string) => {
    const r = await post<{ token: string; usuario: Usuario }>('/auth/login', { usuario: u, pin });
    tokenStore.set(r.token);
    setAviso('');
    setUsuario(r.usuario);
  };

  const logout = () => {
    tokenStore.clear();
    setAviso('');
    setUsuario(null);
  };

  // El servidor cierra las otras sesiones y devuelve un token nuevo para este dispositivo.
  const cambiarPin = async (actual: string, nuevo: string) => {
    const r = await post<{ token: string }>('/auth/cambiar-pin', { actual, nuevo });
    tokenStore.set(r.token);
  };

  return (
    <Ctx.Provider value={{ usuario, cargando, aviso, login, logout, cambiarPin, recargarYo }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
