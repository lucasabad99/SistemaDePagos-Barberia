import { ReactNode } from 'react';

const Sv = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Íconos tomados del prototipo.
export const I = {
  plus: <Sv><path d="M12 5v14M5 12h14" /></Sv>,
  menu: <Sv><path d="M4 6h16M4 12h16M4 18h16" /></Sv>,
  ventas: <Sv><path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6z" /><path d="M10 4v16" strokeDasharray="2 3" /></Sv>,
  caja: <Sv><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></Sv>,
  barberos: <Sv><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></Sv>,
  clientes: <Sv><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></Sv>,
  inventario: <Sv><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></Sv>,
  gastos: <Sv><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Sv>,
  liquidacion: <Sv><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 15h3M8 18h6" /></Sv>,
  impuestos: <Sv><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01" /></Sv>,
  money: <Sv><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></Sv>,
  chart: <Sv><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></Sv>,
};
