import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { Logo } from '../Logo';
import { I } from '../components/Icons';
import { PapelitosDia } from './admin/PapelitosDia';
import { Pagos } from './admin/Pagos';
import { Resumen } from './admin/Resumen';
import { Barberos } from './admin/Barberos';

type Vista = 'hoy' | 'pagos' | 'resumen' | 'barberos';

// Secciones del menú. Las que no tienen `listo` todavía no se construyeron.
const NAV: { k: Vista | string; l: string; ic: keyof typeof I; listo?: boolean }[] = [
  { k: 'hoy', l: 'Hoy', ic: 'ventas', listo: true },
  { k: 'pagos', l: 'Pagos', ic: 'liquidacion', listo: true },
  { k: 'resumen', l: 'Resumen', ic: 'chart', listo: true },
  { k: 'barberos', l: 'Barberos', ic: 'barberos', listo: true },
  { k: 'caja', l: 'Caja', ic: 'caja' },
  { k: 'inventario', l: 'Inventario', ic: 'inventario' },
  { k: 'gastos', l: 'Gastos', ic: 'gastos' },
  { k: 'clientes', l: 'Clientes y QR', ic: 'clientes' },
  { k: 'impuestos', l: 'Impuestos', ic: 'impuestos' },
];

export function AdminHome() {
  const { usuario, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [vista, setVista] = useState<Vista>('hoy');
  // Semana con la que se abre "Pagos" (ej: desde el aviso "de la semana pasada quedan…").
  const [pagosDesde, setPagosDesde] = useState<string | undefined>();
  const me = usuario!;

  const ir = (k: Vista, lunes?: string) => {
    setVista(k);
    setPagosDesde(lunes);
    setDrawer(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="shell">
      <aside className={'side' + (drawer ? ' open' : '')} aria-label="Menú">
        <div className="brand">
          <Logo />
          <div>
            <b>Papelito Barbería</b>
            <span>Administración</span>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.k}
              aria-current={vista === n.k ? 'page' : undefined}
              disabled={!n.listo}
              title={n.listo ? undefined : 'Próximamente'}
              style={n.listo ? undefined : { opacity: 0.4 }}
              onClick={() => ir(n.k as Vista)}
            >
              {I[n.ic]}
              {n.l}
              {!n.listo && <span style={{ marginLeft: 'auto', fontSize: 11 }}>pronto</span>}
            </button>
          ))}
        </nav>
        <div className="me">
          <span className="avatar">{initials(me.nombre)}</span>
          <div className="grow">
            <b>{me.nombre}</b>
            <small>Administrador</small>
          </div>
          <button onClick={logout}>Salir</button>
        </div>
      </aside>
      <div className={'drawer-scrim' + (drawer ? ' open' : '')} onClick={() => setDrawer(false)} />

      <div className="mainc">
        <header className="bar">
          <button className="burger" onClick={() => setDrawer(true)} aria-label="Abrir menú">{I.menu}</button>
          <div className="grow"><b>{NAV.find((n) => n.k === vista)!.l}</b></div>
          <span className="avatar">{initials(me.nombre)}</span>
        </header>
        <div className="content">
          {vista === 'hoy' && <PapelitosDia irAPagos={(lunes) => ir('pagos', lunes)} />}
          {vista === 'pagos' && <Pagos key={pagosDesde ?? 'actual'} lunesInicial={pagosDesde} />}
          {vista === 'resumen' && <Resumen />}
          {vista === 'barberos' && <Barberos />}
        </div>
      </div>
    </div>
  );
}
