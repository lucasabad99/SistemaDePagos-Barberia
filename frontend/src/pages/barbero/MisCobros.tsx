import { useState } from 'react';
import { api, Liquidacion, Pago, Venta } from '../../lib/api';
import { dayKey, dayLabel, dayRange, fmt, fmtK, monthKey, sum, weekDates, weekLabel, weekRange, weekStart } from '../../lib/format';
import { useData } from '../../lib/useData';
import { WeekNav } from '../../components/WeekNav';
import { Calendario } from '../../components/Calendario';
import { Ticket } from '../../components/Ticket';

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Lo que le corresponde cobrar al barbero, con el detalle para respaldarlo:
 * la cuenta es la misma que ve el dueño en "Pagos".
 */
export function MisCobros() {
  const [lunes, setLunes] = useState(weekStart());
  const [mes, setMes] = useState(monthKey());
  const [dia, setDia] = useState(dayKey());

  const liq = useData(() => {
    const r = weekRange(lunes);
    return api<{ barberos: Liquidacion[] }>(`/liquidacion?desde=${r.desde}&hasta=${r.hasta}`);
  }, [lunes]);
  const ventasDia = useData(() => {
    const r = dayRange(dia);
    return api<{ ventas: Venta[] }>(`/ventas?desde=${r.desde}&hasta=${r.hasta}`);
  }, [dia]);
  const historial = useData(() => api<{ pagos: Pago[] }>('/liquidacion/pagos'), []);

  const b = liq.data?.barberos[0];
  const delDia = ventasDia.data?.ventas ?? [];
  const validasDia = delDia.filter((v) => v.estado !== 'anulada');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1>Mis cobros</h1>
        <WeekNav value={lunes} onChange={setLunes} />
      </div>

      <div className="card hero">
        <div className="lbl">Te corresponde · {weekLabel(lunes).toLowerCase()}</div>
        <div className="monto">{b ? fmt(b.comision) : '…'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {b && b.saldo > 0 && <span className="pill warn">Falta cobrar {fmt(b.saldo)}</span>}
          {b && b.saldo <= 0 && b.comision > 0 && <span className="pill ok">Cobrado ✓</span>}
          <span className="small">Del {weekDates(lunes)}</span>
        </div>
        {b && b.comision > 0 && (
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
            <span className="tot">Tu comisión</span>
            <span className="r tot">{fmt(b.comision)}</span>
            {b.pagos.map((p) => (
              <span key={p.id} style={{ display: 'contents' }}>
                <span className="small">Te pagaron el {fechaCorta(p.fecha)}</span>
                <span className="r small">−{fmt(p.monto)}</span>
              </span>
            ))}
            {b.pagado > 0 && (
              <>
                <span className="tot">Falta cobrar</span>
                <span className="r tot">{fmt(Math.max(0, b.saldo))}</span>
              </>
            )}
          </div>
        )}
      </div>

      {b && b.enMano.total > 0 && (
        <div className="note" style={{ borderColor: 'var(--warn)' }}>
          <b>Tenés {fmt(b.enMano.total)} en efectivo para entregar</b> ({b.enMano.cantidad} papelito{b.enMano.cantidad > 1 ? 's' : ''}).
          Hasta que no se lo entregues al dueño, no te puede pagar.
        </div>
      )}

      <div className="card">
        <span className="eyebrow">Tu comisión día por día</span>
        <Calendario mes={mes} onMes={setMes} seleccionado={dia} onSelect={setDia} render={(d) => fmtK(d.comision)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="eyebrow">Papelitos · {dayLabel(dia)}</span>
          {validasDia.length > 0 && <span className="small">{validasDia.length} · comisión {fmt(sum(validasDia, (v) => v.comision))}</span>}
        </div>
        {!ventasDia.data ? (
          <div className="empty">Cargando…</div>
        ) : delDia.length ? (
          <div className="tickets">
            {delDia.map((v) => (
              <Ticket key={v.id} v={v} barbero={false} comision />
            ))}
          </div>
        ) : (
          <div className="empty">No anotaste papelitos ese día.</div>
        )}
      </div>

      {(historial.data?.pagos.length ?? 0) > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eyebrow">Pagos que recibiste</span>
          <div className="card" style={{ padding: '6px 14px' }}>
            <div className="list">
              {historial.data!.pagos.map((p) => (
                <div className="li" key={p.id}>
                  <div className="grow">
                    <div className="name">Semana del {weekDates(dayKey(new Date(p.desde)))}</div>
                    <div className="small">Pagado el {fechaCorta(p.fecha)} · {p.servicios} servicios</div>
                  </div>
                  <span className="amt">{fmt(p.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
