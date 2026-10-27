import { ReactNode } from 'react';
import { api, DiaCalendario } from '../lib/api';
import { addMonths, dayKey, monthGrid, monthKey, monthLabel, monthRange } from '../lib/format';
import { useData } from '../lib/useData';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  mes: string;
  onMes: (mk: string) => void;
  seleccionado?: string;
  onSelect: (dk: string) => void;
  /** contenido chico de cada día con datos (ej: "$9k" o "3") */
  render: (d: DiaCalendario) => ReactNode;
  /** marcar días con transferencias sin confirmar */
  marcarPendientes?: boolean;
}

/** Calendario mensual. Cada día muestra un resumen de sus papelitos; tocarlo lo selecciona. */
export function Calendario({ mes, onMes, seleccionado, onSelect, render, marcarPendientes }: Props) {
  const hoy = dayKey();
  const { data } = useData(() => {
    const r = monthRange(mes);
    return api<{ dias: DiaCalendario[] }>(`/ventas/calendario?desde=${r.desde}&hasta=${r.hasta}`);
  }, [mes]);
  const porDia = new Map((data?.dias ?? []).map((d) => [d.dia, d]));
  const esMesActual = mes >= monthKey();

  return (
    <div className="cal">
      <div className="cal-h">
        <button className="btn sm" onClick={() => onMes(addMonths(mes, -1))} aria-label="Mes anterior">‹</button>
        <b>{monthLabel(mes)}</b>
        <button className="btn sm" onClick={() => onMes(addMonths(mes, 1))} disabled={esMesActual} style={esMesActual ? { opacity: 0.35 } : undefined} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-g">
        {DIAS.map((d, i) => (
          <span key={i} className="cal-dow">{d}</span>
        ))}
        {monthGrid(mes).map((dk) => {
          const d = porDia.get(dk);
          const fuera = monthKey(dk) !== mes;
          const futuro = dk > hoy;
          return (
            <button
              key={dk}
              className={'cal-d' + (fuera ? ' fuera' : '') + (dk === hoy ? ' hoy' : '') + (dk === seleccionado ? ' sel' : '') + (d ? ' con' : '')}
              disabled={futuro}
              onClick={() => onSelect(dk)}
              aria-label={dk + (d ? `: ${d.papelitos} papelitos` : '')}
              aria-pressed={dk === seleccionado}
            >
              <span className="n">{Number(dk.slice(8))}</span>
              {d && !fuera && <span className="v">{render(d)}</span>}
              {marcarPendientes && d && d.pendientes > 0 && !fuera && <i className="cal-pend" title={`${d.pendientes} transferencias sin confirmar`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
