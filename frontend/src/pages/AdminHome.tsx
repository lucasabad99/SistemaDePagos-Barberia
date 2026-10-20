import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { Logo } from '../Logo';
import { I } from '../components/Icons';
import { PapelitosDia } from './admin/PapelitosDia';

// Secciones del menú. Las que no están `listo` todavía no se construyeron.
const NAV: { k: string; l: string; ic: keyof typeof I; listo?: boolean }[] = [
  { k: 'dia', l: 'Papelitos del día', ic: 'ventas', listo: true },
  { k: 'caja', l: 'Caja', ic: 'caja' },
  { k: 'barberos', l: 'Barberos', ic: 'barberos' },
  { k: 'clientes', l: 'Clientes y QR', ic: 'clientes' },
  { k: 'inventario', l: 'Inventario', ic: 'inventario' },
  { k: 'gastos', l: 'Gastos', ic: 'gastos' },
  { k: 'liquidacion', l: 'Fin de mes', ic: 'liquidacion' },
  { k: 'impuestos', l: 'Impuestos', ic: 'impuestos' },
];

export function AdminHome() {
  const { usuario, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const me = usuario!;

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
              aria-current={n.listo ? 'page' : undefined}
              disabled={!n.listo}
              title={n.listo ? undefined : 'Próximamente'}
              style={n.listo ? undefined : { opacity: 0.4 }}
              onClick={() => setDrawer(false)}
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
          <div className="grow"><b>Papelitos del día</b></div>
          <span className="avatar">{initials(me.nombre)}</span>
        </header>
        <div className="content">
          <PapelitosDia />
        </div>
      </div>
    </div>
  );
}
