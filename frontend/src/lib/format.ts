const pad = (n: number) => String(n).padStart(2, '0');

export const fmt = (n: number) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');

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
