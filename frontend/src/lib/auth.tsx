import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore, Usuario } from './api';

interface AuthCtx {
  usuario: Usuario | null;
  cargando: boolean;
  login: (usuario: string, pin: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) return setCargando(false);
    api<{ usuario: Usuario }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => tokenStore.clear())
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUsuario(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (u: string, pin: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: u, pin }),
    });
    tokenStore.set(r.token);
    setUsuario(r.usuario);
  };

  const logout = () => {
    tokenStore.clear();
    setUsuario(null);
  };

  return <Ctx.Provider value={{ usuario, cargando, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
