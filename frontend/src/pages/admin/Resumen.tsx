import { useState } from 'react';
import { api, Venta } from '../../lib/api';
import { dayKey, dayRange, fmt, monthKey, monthRange, sum, weekRange, weekStart } from '../../lib/format';
import { useData } from '../../lib/useData';
import { Kpi } from '../../components/Card';

type Periodo = 'hoy' | 'semana' | 'mes';
const PERIODOS: [Periodo, string][] = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes']];

const rango = (p: Periodo) => (p === 'hoy' ? dayRange(dayKey()) : p === 'semana' ? weekRange(weekStart()) : monthRange(monthKey()));

/** Números del negocio para el que quiera mirarlos. Lo que hay que pagar está en "Hoy" y "Pagos". */
export function Resumen() {
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const ventas = useData(() => {
    const r = rango(periodo);
    return api<{ ventas: Venta[] }>(`/ventas?desde=${r.desde}&hasta=${r.hasta}`);
  }, [periodo]);

  const validas = (ventas.data?.ventas ?? []).filter((v) => v.estado !== 'anulada');
  const efectivo = sum(validas.filter((v) => v.metodo === 'efectivo'), (v) => v.total);
  const transf = sum(validas.filter((v) => v.metodo === 'transferencia'), (v) => v.total);
  const comisiones = sum(validas, (v) => v.comision);
  const servicios = sum(validas, (v) => v.items.filter((x) => x.tipo === 'servicio').length);

  const personas = new Map<string, { nombre: string; esDueño: boolean; servicios: number; efectivo: number; transf: number; comision: number }>();
  for (const v of validas) {
    const p = personas.get(v.barbero.id) ?? { nombre: v.barbero.nombre, esDueño: v.barbero.rol === 'admin', servicios: 0, efectivo: 0, transf: 0, comision: 0 };
    p.servicios += v.items.filter((x) => x.tipo === 'servicio').length;
    if (v.metodo === 'efectivo') p.efectivo += v.total;
    else p.transf += v.total;
    p.comision += v.comision;
    personas.set(v.barbero.id, p);
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Resumen</h1>
          <p className="sub">Los números del negocio</p>
        </div>
        <div className="chips">
          {PERIODOS.map(([k, l]) => (
            <button key={k} aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>{l}</button>
          ))}
        </div>
      </div>

      {ventas.error && <div className="demo">{ventas.error}</div>}

      <div className="grid kpis">
        <Kpi l="Total cobrado" v={fmt(efectivo + transf)} ic="money" cls="ok" d={`${validas.length} papelitos · ${servicios} servicios`} />
        <Kpi l="Efectivo" v={fmt(efectivo)} ic="caja" cls="gold" />
        <Kpi l="Transferencias" v={fmt(transf)} ic="ventas" cls="blue" d={`incluye ${fmt(sum(validas, (v) => v.recargo))} de recargo`} />
        <Kpi l="Comisiones" v={fmt(comisiones)} ic="barberos" cls="warn" d={`queda ${fmt(efectivo + transf - comisiones)} para la barbería`} />
      </div>

      {personas.size > 0 && (
        <div className="card">
          <h2>Por barbero</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Barbero</th>
                  <th className="r">Servicios</th>
                  <th className="r">Efectivo</th>
                  <th className="r">Transferencia</th>
                  <th className="r">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {[...personas.values()].map((p) => (
                  <tr key={p.nombre}>
                    <td>{p.nombre}</td>
                    <td className="r mono">{p.servicios}</td>
                    <td className="r mono">{fmt(p.efectivo)}</td>
                    <td className="r mono">{fmt(p.transf)}</td>
                    <td className="r mono">{p.esDueño ? '—' : fmt(p.comision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {ventas.data && !validas.length && <div className="empty">No hay papelitos en este período.</div>}
    </>
  );
}
