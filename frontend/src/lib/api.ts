const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
const TOKEN_KEY = 'barberia.token';

// Cada pestaña guarda su propia sesión (sessionStorage), así se puede tener al dueño en una
// y a un barbero en otra sin que se pisen. Además se recuerda la última sesión (localStorage)
// para que una pestaña nueva o el navegador reabierto entren directo, sin pedir el PIN.
// Los accesos van en try/catch porque en modo privado algunos navegadores bloquean el storage.
const leer = (s: Storage, k = TOKEN_KEY) => { try { return s.getItem(k); } catch { return null; } };
const escribir = (s: Storage, t: string, k = TOKEN_KEY) => { try { s.setItem(k, t); } catch { /* sin storage */ } };
const borrar = (s: Storage, k = TOKEN_KEY) => { try { s.removeItem(k); } catch { /* sin storage */ } };

// Local en el que está parado el dueño en esta pestaña. Viaja en cada pedido (X-Local).
// Se olvida al entrar de nuevo: el dueño elige el local cada vez que inicia sesión.
const LOCAL_KEY = 'barberia.local';
export const localStore = {
  get: () => leer(sessionStorage, LOCAL_KEY),
  set: (id: string) => escribir(sessionStorage, id, LOCAL_KEY),
  clear: () => borrar(sessionStorage, LOCAL_KEY),
};

export const tokenStore = {
  get: () => {
    const propio = leer(sessionStorage);
    if (propio) return propio;
    const ultimo = leer(localStorage);
    if (ultimo) escribir(sessionStorage, ultimo); // la pestaña nueva adopta la última sesión
    return ultimo;
  },
  set: (t: string) => {
    escribir(sessionStorage, t);
    escribir(localStorage, t);
  },
  clear: () => {
    // Solo olvida la "última sesión" si es la de esta pestaña: salir como Nico no cierra a Darwin.
    if (leer(localStorage) === leer(sessionStorage)) borrar(localStorage);
    borrar(sessionStorage);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const local = localStore.get();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(local ? { 'X-Local': local } : {}),
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
  // El local guardado ya no vale (ej: se borró): el dueño vuelve a elegir.
  if (res.status === 400 && data.codigo === 'ELEGIR_LOCAL') {
    localStore.clear();
    window.dispatchEvent(new Event('local:elegir'));
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
  /** id del local donde trabaja (null para el dueño) */
  local: string | null;
}

export interface Local {
  id: string;
  nombre: string;
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
/** Producto como lo ve el dueño en Inventario (stock del local en el que está parado). */
export interface ProductoInv extends Producto {
  costo: number;
  activo: boolean;
  vendidosMes: number;
  otrosLocales: { id: string; nombre: string; stock: number }[];
}
export type TipoMovimiento = 'ingreso' | 'ajuste' | 'venta' | 'anulacion';
export interface MovimientoStock {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  cant: number;
  stock: number | null;
  costo: number | null;
  nota: string | null;
  num: number | null;
  usuario: { id: string; nombre: string } | null;
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
