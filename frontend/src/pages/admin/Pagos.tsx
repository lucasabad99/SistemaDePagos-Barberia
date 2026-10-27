import { useState } from 'react';
import { api, Liquidacion, post } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { fmt, initials, plural, sum, weekDates, weekLabel, weekRange, weekStart } from '../../lib/format';
import { useData } from '../../lib/useData';
import { Sheet } from '../../components/Sheet';
import { WeekNav } from '../../components/WeekNav';
import { RecibirSheet } from '../../components/RecibirSheet';

type Hoja = { tipo: 'pagar'; b: Liquidacion } | { tipo: 'recibir'; b: Liquidacion } | null;

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

/** Liquidación semanal de comisiones: cuánto le corresponde a cada barbero y registrar el pago. */
export function Pagos({ lunesInicial }: { lunesInicial?: string }) {
  const toast = useToast();
  const [lunes, setLunes] = useState(lunesInicial ?? weekStart());
  const [hoja, setHoja] = useState<Hoja>(null);
  const liq = useData(() => {
    const r = weekRange(lunes);
    return api<{ barberos: Liquidacion[]; total: number }>(`/liquidacion?desde=${r.desde}&hasta=${r.hasta}`);
  }, [lunes]);

  const todos = liq.data?.barberos ?? [];
  const conMovimiento = todos.filter((b) => b.comision > 0 || b.saldo !== 0 || b.enMano.total > 0);
  const sinMovimiento = todos.filter((b) => !conMovimiento.includes(b));
  const total = liq.data?.total ?? 0;

  return (
    <>
      <div className="head">
        <div>
          <h1>Pagos</h1>
          <p className="sub">Comisiones de los barberos, de lunes a domingo</p>
        </div>
        <WeekNav value={lunes} onChange={setLunes} />
      </div>

      <div className="card hero">
        <div className="lbl">A pagar · {weekLabel(lunes).toLowerCase()} ({weekDates(lunes)})</div>
        <div className="monto">{liq.data ? fmt(total) : '…'}</div>
        <div className="small">
          {liq.data && (total > 0 ? `Total entre ${conMovimiento.filter((b) => b.saldo > 0).length} barberos` : conMovimiento.length ? 'Todo pagado ✓' : 'No hubo comisiones esta semana')}
        </div>
      </div>

      {liq.error && <div className="demo">{liq.error}</div>}

      <div className="grid g3">
        {conMovimiento.map((b) => {
          const bloqueado = b.enMano.total > 0;
          return (
            <div className="card" key={b.barbero.id}>
              <div className="li" style={{ padding: 0, border: 0 }}>
                <span className="avatar">{initials(b.barbero.nombre)}</span>
                <div className="grow">
                  <div className="name">{b.barbero.nombre}</div>
                  <div className="small">{plural(b.papelitos, 'papelito')}</div>
                </div>
                {b.saldo > 0 ? <span className="pill warn">Falta pagar</span> : b.comision > 0 ? <span className="pill ok">Pagado</span> : null}
              </div>
              <div className="ledger">
                {b.servicios.map((s) => (
                  <span key={s.nombre} style={{ display: 'contents' }}>
                    <span>{s.nombre}</span>
                    <span className="r">×{s.cant}</span>
                  </span>
                ))}
                {b.productos > 0 && (
                  <>
                    <span>Productos vendidos</span>
                    <span className="r">×{b.productos}</span>
                  </>
                )}
                <span className="tot">Comisión de la semana</span>
                <span className="r tot">{fmt(b.comision)}</span>
                {b.pagos.map((p) => (
                  <span key={p.id} style={{ display: 'contents' }}>
                    <span className="small">Pagado el {fechaCorta(p.fecha)}</span>
                    <span className="r small">−{fmt(p.monto)}</span>
                  </span>
                ))}
                {b.pagado > 0 && (
                  <>
                    <span className="tot">Falta pagar</span>
                    <span className="r tot">{fmt(Math.max(0, b.saldo))}</span>
                  </>
                )}
              </div>

              {b.saldo > 0 &&
                (bloqueado ? (
                  <>
                    <div className="note" style={{ borderColor: 'var(--warn)' }}>
                      <b>Primero tiene que entregarte {fmt(b.enMano.total)}</b> en efectivo ({b.enMano.cantidad} papelito{b.enMano.cantidad > 1 ? 's' : ''}). Después le podés pagar.
                    </div>
                    <button className="btn okb" onClick={() => setHoja({ tipo: 'recibir', b })}>Recibí {fmt(b.enMano.total)}</button>
                  </>
                ) : (
                  <button className="btn dark" onClick={() => setHoja({ tipo: 'pagar', b })}>Pagar {fmt(b.saldo)} a {b.barbero.nombre}</button>
                ))}
              {b.saldo <= 0 && bloqueado && (
                <div className="small" style={{ color: 'var(--warn)' }}>Tiene {fmt(b.enMano.total)} en efectivo sin entregar</div>
              )}
            </div>
          );
        })}
      </div>

      {liq.data && !conMovimiento.length && <div className="empty">Ningún barbero tuvo comisiones esta semana.</div>}
      {sinMovimiento.length > 0 && conMovimiento.length > 0 && (
        <p className="small" style={{ margin: 0 }}>Sin papelitos esta semana: {sinMovimiento.map((b) => b.barbero.nombre).join(', ')}.</p>
      )}

      <div className="note">
        <b>Cómo se calcula.</b> Cada papelito guarda la comisión del barbero en el momento en que se anotó. Acá se suman los de la semana (lunes a domingo), sin contar los anulados.
        El barbero ve exactamente la misma cuenta en su celular, en “Mis cobros”.
        <ul>
          <li>Si un barbero tiene efectivo sin entregar, primero lo recibís y después le pagás.</li>
          <li>Si le pagás antes de que termine la semana y después trabaja más, la diferencia queda como “Falta pagar”.</li>
        </ul>
      </div>

      {hoja?.tipo === 'recibir' && (
        <RecibirSheet
          barbero={hoja.b.barbero}
          onClose={() => setHoja(null)}
          onDone={(t) => {
            toast(`Recibiste ${fmt(t)} de ${hoja.b.barbero.nombre}`);
            setHoja(null);
            liq.reload();
          }}
        />
      )}
      {hoja?.tipo === 'pagar' && (
        <PagarSheet
          b={hoja.b}
          lunes={lunes}
          onClose={() => setHoja(null)}
          onDone={() => {
            toast(`Pago a ${hoja.b.barbero.nombre} registrado`);
            setHoja(null);
            liq.reload();
          }}
        />
      )}
    </>
  );
}

function PagarSheet({ b, lunes, onClose, onDone }: { b: Liquidacion; lunes: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);

  async function pagar() {
    setEnviando(true);
    try {
      await post('/liquidacion/pagar', { ...weekRange(lunes), barberoId: b.barbero.id });
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div>
        <h1>Pagarle a {b.barbero.nombre}</h1>
        <p className="sub">Semana del {weekDates(lunes)}</p>
      </div>
      <div className="card">
        <div className="ledger">
          <span>{plural(sum(b.servicios, (s) => s.cant), 'servicio')}{b.productos ? ` y ${plural(b.productos, 'producto')}` : ''}</span>
          <span className="r">{fmt(b.comision)}</span>
          {b.pagado > 0 && (
            <>
              <span>Ya pagado</span>
              <span className="r">−{fmt(b.pagado)}</span>
            </>
          )}
          <span className="tot">Le pagás</span>
          <span className="r tot">{fmt(b.saldo)}</span>
        </div>
      </div>
      <div className="note">Conviene que {b.barbero.nombre} firme un recibo o te haga factura por este pago.</div>
      <button className="big" onClick={pagar} disabled={enviando}>{enviando ? 'Registrando…' : `Registrar pago de ${fmt(b.saldo)}`}</button>
      <button className="btn ghost" onClick={onClose}>Cancelar</button>
    </Sheet>
  );
}
