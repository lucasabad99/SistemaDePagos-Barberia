const pad = (n: number) => String(n).padStart(2, '0');

export const fmt = (n: number) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');

/** Versión corta para lugares chicos (calendario): $9k, $1,2M */
export const fmtK = (n: number) =>
  n >= 1e6 ? '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + n;

export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};

export const initials = (n: string) =>
  n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** 'YYYY-MM-DD' en hora local */
export const dayKey = (d: Date = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

const parseDay = (dk: string) => {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Inicio y fin (exclusivo) del día local, en ISO para mandarle a la API */
export function dayRange(dk: string) {
  const desde = parseDay(dk);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

export const addDays = (dk: string, n: number) => {
  const d = parseDay(dk);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

export const dayLabel = (dk: string) => {
  if (dk === dayKey()) return 'Hoy';
  if (dk === addDays(dayKey(), -1)) return 'Ayer';
  return capitalizar(parseDay(dk).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }));
};

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Martes, 20 de octubre" */
export const longDate = (dk: string) =>
  capitalizar(parseDay(dk).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));

export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

/** "1 servicio", "3 servicios" */
export const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? '' : 's'}`;

/* ---------- Semanas (de lunes a domingo) ---------- */

/** Lunes de la semana del día dado */
export const weekStart = (dk: string = dayKey()) => {
  const d = parseDay(dk);
  return addDays(dk, -((d.getDay() + 6) % 7));
};

/** Inicio (lunes) y fin exclusivo (lunes siguiente), en ISO para la API */
export const weekRange = (lunes: string) => ({ desde: dayRange(lunes).desde, hasta: dayRange(addDays(lunes, 7)).desde });

const corto = (dk: string) => parseDay(dk).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

/** "Esta semana", "Semana pasada" o "26 oct – 1 nov" */
export const weekLabel = (lunes: string) => {
  const actual = weekStart();
  if (lunes === actual) return 'Esta semana';
  if (lunes === addDays(actual, -7)) return 'Semana pasada';
  return weekDates(lunes);
};

/** "26 oct – 1 nov" */
export const weekDates = (lunes: string) => `${corto(lunes)} – ${corto(addDays(lunes, 6))}`;

/* ---------- Meses ---------- */
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'YYYY-MM' */
export const monthKey = (dk: string = dayKey()) => dk.slice(0, 7);

export const addMonths = (mk: string, n: number) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
};

export const monthLabel = (mk: string) => {
  const [y, m] = mk.split('-').map(Number);
  return capitalizar(MESES[m - 1]) + (y === new Date().getFullYear() ? '' : ' ' + y);
};

/** Rango del mes en ISO para la API */
export const monthRange = (mk: string) => ({ desde: dayRange(mk + '-01').desde, hasta: dayRange(addMonths(mk, 1) + '-01').desde });

/** Días a mostrar en la grilla del mes: arranca el lunes anterior al 1 y completa semanas enteras */
export function monthGrid(mk: string) {
  const primero = mk + '-01';
  const inicio = weekStart(primero);
  const finMes = addDays(addMonths(mk, 1) + '-01', -1);
  const dias: string[] = [];
  for (let d = inicio; d <= finMes || dias.length % 7; d = addDays(d, 1)) dias.push(d);
  return dias;
}
