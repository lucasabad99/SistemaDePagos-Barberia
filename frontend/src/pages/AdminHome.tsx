import { useEffect, useState } from 'react';
import { api, Local, localStore } from '../lib/api';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { useData } from '../lib/useData';
import { Logo } from '../Logo';
import { I } from '../components/Icons';
import { PapelitosDia } from './admin/PapelitosDia';
import { Pagos } from './admin/Pagos';
import { Resumen } from './admin/Resumen';
import { Barberos } from './admin/Barberos';
import { ElegirLocal } from './admin/ElegirLocal';
import { Inventario } from './admin/Inventario';
import { Servicios } from './admin/Servicios';

type Vista = 'hoy' | 'pagos' | 'resumen' | 'barberos' | 'servicios' | 'inventario';

// Secciones del menú. Las que no tienen `listo` todavía no se construyeron.
const NAV: { k: Vista | string; l: string; ic: keyof typeof I; listo?: boolean }[] = [
  { k: 'hoy', l: 'Hoy', ic: 'ventas', listo: true },
  { k: 'pagos', l: 'Pagos', ic: 'liquidacion', listo: true },
  { k: 'resumen', l: 'Resumen', ic: 'chart', listo: true },
  { k: 'barberos', l: 'Barberos', ic: 'barberos', listo: true },
  { k: 'servicios', l: 'Servicios', ic: 'money', listo: true },
  { k: 'inventario', l: 'Inventario', ic: 'inventario', listo: true },
  { k: 'caja', l: 'Caja', ic: 'caja' },
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

  // Local en el que está parado. Sin local elegido, se muestra la pantalla para elegirlo.
  const locales = useData(() => api<{ locales: Local[] }>('/locales').then((r) => r.locales), []);
  const [localId, setLocalId] = useState<string | null>(() => localStore.get());
  const [eligiendo, setEligiendo] = useState(false);
  const local = locales.data?.find((l) => l.id === localId) ?? null;

  useEffect(() => {
    const onElegir = () => setLocalId(null);
    window.addEventListener('local:elegir', onElegir);
    return () => window.removeEventListener('local:elegir', onElegir);
  }, []);

  // Si el local guardado ya no existe, se vuelve a elegir.
  useEffect(() => {
    if (locales.data && localId && !local) {
      localStore.clear();
      setLocalId(null);
    }
  }, [locales.data, localId, local]);

  const elegir = (l: Local) => {
    localStore.set(l.id);
    setLocalId(l.id);
    setEligiendo(false);
    setVista('hoy');
    setPagosDesde(undefined);
    window.scrollTo(0, 0);
  };

  const ir = (k: Vista, lunes?: string) => {
    setVista(k);
    setPagosDesde(lunes);
    setDrawer(false);
    window.scrollTo(0, 0);
  };

  if (!local || eligiendo) {
    return <ElegirLocal me={me} locales={locales.data} actual={localId} onElegir={elegir} onSalir={logout} />;
  }

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
        <button className="local-actual" onClick={() => { setDrawer(false); setEligiendo(true); }}>
          {I.local}
          <span className="grow">
            <small>Estás en</small>
            <b>Local {local.nombre}</b>
          </span>
          <span className="cambiar">Cambiar</span>
        </button>
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
            <small>Administrador · v{__VERSION__}</small>
          </div>
          <button onClick={logout}>Salir</button>
        </div>
      </aside>
      <div className={'drawer-scrim' + (drawer ? ' open' : '')} onClick={() => setDrawer(false)} />

      <div className="mainc">
        <header className="bar">
          <button className="burger" onClick={() => setDrawer(true)} aria-label="Abrir menú">{I.menu}</button>
          <div className="grow"><b>{NAV.find((n) => n.k === vista)!.l}</b></div>
          <button className="chip-local" onClick={() => setEligiendo(true)} title="Cambiar de local">
            {I.local}
            {local.nombre}
          </button>
        </header>
        {/* key: al cambiar de local se recarga todo con los datos del otro local */}
        <div className="content" key={local.id}>
          {vista === 'hoy' && <PapelitosDia irAPagos={(lunes) => ir('pagos', lunes)} />}
          {vista === 'pagos' && <Pagos key={pagosDesde ?? 'actual'} lunesInicial={pagosDesde} />}
          {vista === 'resumen' && <Resumen />}
          {vista === 'barberos' && <Barberos locales={locales.data ?? []} localActual={local} />}
          {vista === 'servicios' && <Servicios />}
          {vista === 'inventario' && <Inventario localActual={local} />}
        </div>
      </div>
    </div>
  );
}
