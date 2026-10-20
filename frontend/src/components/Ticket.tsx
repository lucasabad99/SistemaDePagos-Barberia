import { Venta } from '../lib/api';
import { fmt, hhmm } from '../lib/format';

export function EstadoPill({ v }: { v: Venta }) {
  if (v.estado === 'anulada') return <span className="pill mute">Anulado</span>;
  if (v.metodo === 'efectivo')
    return v.estado === 'entregado' ? (
      <span className="pill ok">Efectivo en caja</span>
    ) : (
      <span className="pill warn">Lo tiene {v.barbero.nombre}</span>
    );
  return v.estado === 'verificado' ? (
    <span className="pill ok">Transferencia acreditada</span>
  ) : (
    <span className="pill blue">Confirmar en banco</span>
  );
}

export const descripcion = (v: Venta) => v.items.map((x) => x.nombre + (x.cant > 1 ? ' ×' + x.cant : '')).join(' + ');

interface Props {
  v: Venta;
  /** mostrar el nombre del barbero (vista del dueño) */
  barbero?: boolean;
  /** mostrar la comisión en vez del total (vista del barbero) */
  comision?: boolean;
  onClick?: () => void;
}

export function Ticket({ v, barbero = true, comision = false, onClick }: Props) {
  const anulada = v.estado === 'anulada';
  return (
    <div
      className={'ticket' + (onClick ? ' tap' : '')}
      style={anulada ? { opacity: 0.55 } : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stub">
        <span className="n">Nº{v.num}</span>
        <span className="t">{hhmm(v.fecha)}</span>
      </div>
      <div className="tbody">
        <div className="tmain">
          <span className="w" style={anulada ? { textDecoration: 'line-through' } : undefined}>
            {descripcion(v)}
          </span>
          <span className="meta">
            <i className={'dot ' + (v.metodo === 'efectivo' ? 'ef' : 'tr')} />
            {barbero && v.barbero.nombre + ' · '}
            {v.metodo === 'efectivo' ? 'Efectivo' : 'Transferencia'}
          </span>
          <EstadoPill v={v} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="amt">{fmt(comision ? v.comision : v.total)}</div>
          {comision ? (
            <div className="small" style={{ fontSize: 11 }}>tu comisión</div>
          ) : v.recargo ? (
            <div className="small" style={{ fontSize: 11 }}>+{fmt(v.recargo)} rec.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
