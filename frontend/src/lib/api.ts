const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
const TOKEN_KEY = 'barberia.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    // Token vencido: cerramos sesión y volvemos al login.
    tokenStore.clear();
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Error de conexión');
  return data as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export type Rol = 'admin' | 'barbero';
export interface Usuario {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  comision: number;
  activo: boolean;
}

export interface Servicio {
  id: string;
  nombre: string;
  precio: number;
}
export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  min: number;
}
export interface Config {
  negocio: string;
  recargoPct: number;
  comisionProducto: number;
}
export interface Catalogo {
  servicios: Servicio[];
  productos: Producto[];
  config: Config;
}

export type Metodo = 'efectivo' | 'transferencia';
export type EstadoVenta = 'en_barbero' | 'entregado' | 'pendiente' | 'verificado' | 'anulada';
export interface Venta {
  id: string;
  num: number;
  fecha: string;
  barbero: { id: string; nombre: string; rol: Rol };
  items: { tipo: 'servicio' | 'producto'; refId: string; nombre: string; precio: number; cant: number }[];
  metodo: Metodo;
  subtotal: number;
  recargo: number;
  total: number;
  comision: number;
  estado: EstadoVenta;
  entregadoEn: string | null;
  motivoAnulacion: string | null;
}
export interface Pago {
  id: string;
  barbero: string | { id: string; nombre: string };
  desde: string;
  hasta: string;
  monto: number;
  servicios: number;
  fecha: string;
}
export interface Liquidacion {
  barbero: { id: string; nombre: string; activo: boolean };
  papelitos: number;
  servicios: { nombre: string; cant: number }[];
  productos: number;
  comision: number;
  pagado: number;
  saldo: number;
  enMano: { cantidad: number; total: number };
  pagos: Pago[];
}
export interface DiaCalendario {
  dia: string;
  papelitos: number;
  servicios: number;
  total: number;
  comision: number;
  pendientes: number;
}
export interface EnMano {
  barberoId: string;
  cantidad: number;
  total: number;
}
