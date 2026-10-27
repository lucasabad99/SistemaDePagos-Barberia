import { useState } from 'react';
import { api, Catalogo, EnMano, Venta } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dayKey, dayRange, fmt, longDate, sum } from '../lib/format';
import { useData } from '../lib/useData';
import { Logo } from '../Logo';
import { I } from '../components/Icons';
import { Ticket } from '../components/Ticket';
import { DayNav } from '../components/DayNav';
import { VentaSheet } from '../components/VentaSheet';
import { CambiarPinSheet } from '../components/CambiarPinSheet';

export function BarberoHome() {
  const { usuario, logout } = useAuth();
  const me = usuario!;
  const [dia, setDia] = useState(dayKey());
  const [anotando, setAnotando] = useState(false);
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const esHoy = dia === dayKey();

  const catalogo = useData(() => api<Catalogo>('/catalogo'), []);
  const ventas = useData(() => {
    const { desde, hasta } = dayRange(dia);
    return api<{ ventas: Venta[] }>(`/ventas?desde=${desde}&hasta=${hasta}`);
  }, [dia]);
  const mano = useData(() => api<{ enMano: EnMano[] }>('/ventas/en-mano'), []);

  const lista = ventas.data?.ventas ?? [];
  const validas = lista.filter((v) => v.estado !== 'anulada');
  const servicios = sum(validas, (v) => v.items.filter((x) => x.tipo === 'servicio').length);
  const comision = sum(validas, (v) => v.comision);
  const enMano = mano.data?.enMano[0]?.total ?? 0;

  const recargar = () => {
    ventas.reload();
    mano.reload();
    catalogo.reload(); // el stock cambió
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

        <div className="pcontent">
          <div>
            <h1>Hola, {me.nombre}</h1>
            <p className="sub">{longDate(dayKey())}</p>
          </div>

          <button className="big" onClick={() => setAnotando(true)} disabled={!catalogo.data}>
            {I.plus}Anotar corte
          </button>

          <div className="stats">
            <div className="stat">
              <div className="v">{servicios}</div>
              <div className="l">servicios {esHoy ? 'hoy' : 'ese día'}</div>
            </div>
            <div className="stat gold">
              <div className="v">{fmt(comision)}</div>
              <div className="l">tu comisión</div>
            </div>
            <div className={'stat' + (enMano ? ' hot' : '')}>
              <div className="v">{fmt(enMano)}</div>
              <div className="l">efectivo para entregar</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="eyebrow">Tus papelitos</span>
              <DayNav value={dia} onChange={setDia} />
            </div>
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
              <div className="empty">
                {esHoy ? 'Todavía no anotaste nada hoy. Tocá “Anotar corte” cuando llegue un cliente.' : 'No anotaste papelitos ese día.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {anotando && catalogo.data && (
        <VentaSheet
          catalogo={catalogo.data}
          esAdmin={false}
          meId={me.id}
          onClose={() => setAnotando(false)}
          onSaved={() => {
            setDia(dayKey());
            recargar();
          }}
        />
      )}
      {cambiandoPin && <CambiarPinSheet onClose={() => setCambiandoPin(false)} />}
    </>
  );
}
