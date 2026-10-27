import { useState } from 'react';
import { api, Catalogo, EnMano, Venta } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dayKey, dayRange, fmt, longDate, sum } from '../lib/format';
import { useData } from '../lib/useData';
import { Logo } from '../Logo';
import { I } from '../components/Icons';
import { Ticket } from '../components/Ticket';
import { VentaSheet } from '../components/VentaSheet';
import { CambiarPinSheet } from '../components/CambiarPinSheet';
import { MisCobros } from './barbero/MisCobros';

type Tab = 'hoy' | 'cobros';

export function BarberoHome() {
  const { usuario, logout } = useAuth();
  const me = usuario!;
  const [tab, setTab] = useState<Tab>('hoy');
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const catalogo = useData(() => api<Catalogo>('/catalogo'), []);

  const irA = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <div className="phone">
        <header className="ptop">
          <Logo className="lg" />
          <div className="grow">
            <b>{me.nombre}</b>
            <small>{catalogo.data?.config.negocio ?? 'Barbero'}</small>
          </div>
          <button onClick={() => setCambiandoPin(true)}>PIN</button>
          <button onClick={logout}>Salir</button>
        </header>
        <div className="pcontent">{tab === 'hoy' ? <Hoy catalogo={catalogo.data} onCatalogoCambio={catalogo.reload} /> : <MisCobros />}</div>
      </div>

      <nav className="ptabs">
        <div className="in">
          <button onClick={() => irA('hoy')} aria-current={tab === 'hoy' ? 'page' : undefined}>{I.barberos}Hoy</button>
          <button onClick={() => irA('cobros')} aria-current={tab === 'cobros' ? 'page' : undefined}>{I.liquidacion}Mis cobros</button>
        </div>
      </nav>

      {cambiandoPin && <CambiarPinSheet onClose={() => setCambiandoPin(false)} />}
    </>
  );
}

/** Pestaña "Hoy": anotar cortes y ver los papelitos del día. */
function Hoy({ catalogo, onCatalogoCambio }: { catalogo: Catalogo | null; onCatalogoCambio: () => void }) {
  const { usuario } = useAuth();
  const me = usuario!;
  const [anotando, setAnotando] = useState(false);
  const hoy = dayKey();

  const ventas = useData(() => {
    const { desde, hasta } = dayRange(hoy);
    return api<{ ventas: Venta[] }>(`/ventas?desde=${desde}&hasta=${hasta}`);
  }, [hoy]);
  const mano = useData(() => api<{ enMano: EnMano[] }>('/ventas/en-mano'), []);

  const lista = ventas.data?.ventas ?? [];
  const validas = lista.filter((v) => v.estado !== 'anulada');
  const servicios = sum(validas, (v) => v.items.filter((x) => x.tipo === 'servicio').length);
  const comision = sum(validas, (v) => v.comision);
  const enMano = mano.data?.enMano[0]?.total ?? 0;

  return (
    <>
      <div>
        <h1>Hola, {me.nombre}</h1>
        <p className="sub">{longDate(hoy)}</p>
      </div>

      <button className="big" onClick={() => setAnotando(true)} disabled={!catalogo}>
        {I.plus}Anotar corte
      </button>

      <div className="stats">
        <div className="stat">
          <div className="v">{servicios}</div>
          <div className="l">servicios hoy</div>
        </div>
        <div className="stat gold">
          <div className="v">{fmt(comision)}</div>
          <div className="l">tu comisión hoy</div>
        </div>
        <div className={'stat' + (enMano ? ' hot' : '')}>
          <div className="v">{fmt(enMano)}</div>
          <div className="l">efectivo para entregar</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="eyebrow">Tus papelitos de hoy</span>
        {ventas.error && <div className="empty">{ventas.error}</div>}
        {!ventas.data && !ventas.error ? (
          <div className="empty">Cargando…</div>
        ) : lista.length ? (
          <div className="tickets">
            {lista.map((v) => (
              <Ticket key={v.id} v={v} barbero={false} comision />
            ))}
          </div>
        ) : (
          <div className="empty">Todavía no anotaste nada hoy. Tocá “Anotar corte” cuando llegue un cliente.</div>
        )}
        <p className="small" style={{ margin: 0 }}>Los días anteriores y lo que te corresponde cobrar están en “Mis cobros”.</p>
      </div>

      {anotando && catalogo && (
        <VentaSheet
          catalogo={catalogo}
          esAdmin={false}
          meId={me.id}
          onClose={() => setAnotando(false)}
          onSaved={() => {
            ventas.reload();
            mano.reload();
            onCatalogoCambio(); // el stock cambió
          }}
        />
      )}
    </>
  );
}
