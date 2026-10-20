import { useState } from 'react';
import { Catalogo, Metodo, post, Usuario, Venta } from '../lib/api';
import { fmt, hhmm } from '../lib/format';
import { Sheet } from './Sheet';
import { descripcion } from './Ticket';
import { I } from './Icons';

interface Props {
  catalogo: Catalogo;
  esAdmin: boolean;
  meId: string;
  /** solo admin: a quién se le anota el papelito */
  barberos?: Usuario[];
  onClose: () => void;
  onSaved: (v: Venta) => void;
}

export function VentaSheet({ catalogo, esAdmin, meId, barberos, onClose, onSaved }: Props) {
  const { servicios, productos, config } = catalogo;
  const [barberoId, setBarberoId] = useState(meId);
  const [servicioId, setServicioId] = useState<string | null>(servicios[0]?.id ?? null);
  const [prods, setProds] = useState<Record<string, number>>({});
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [visto, setVisto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<Venta | null>(null);

  const svc = servicios.find((s) => s.id === servicioId);
  const elegidos = productos.filter((p) => prods[p.id] > 0);
  const subtotal = (svc?.precio ?? 0) + elegidos.reduce((s, p) => s + p.precio * prods[p.id], 0);
  const conRecargo = subtotal + Math.round((subtotal * config.recargoPct) / 100);
  const total = metodo === 'transferencia' ? conRecargo : subtotal;
  const ok = subtotal > 0 && metodo && (metodo === 'efectivo' || visto) && !guardando;

  const cambiarCant = (id: string, d: number) => setProds((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + d) }));

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const { venta } = await post<{ venta: Venta }>('/ventas', {
        barberoId: esAdmin ? barberoId : undefined,
        servicioId: servicioId ?? undefined,
        productos: elegidos.map((p) => ({ id: p.id, cant: prods[p.id] })),
        metodo,
        comprobanteVisto: metodo === 'transferencia' ? visto : undefined,
      });
      setListo(venta);
      onSaved(venta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  if (listo)
    return (
      <Sheet onClose={onClose}>
        <div className="bigticket">
          <span className="small">Papelito</span>
          <span className="n">Nº{listo.num}</span>
          <span className="small">
            {descripcion(listo)} · {listo.barbero.nombre} · {hhmm(listo.fecha)}
          </span>
          <b className="amt" style={{ fontSize: 18, marginTop: 6 }}>{fmt(listo.total)}</b>
        </div>
        <p className="sub" style={{ textAlign: 'center', margin: 0 }}>
          {esAdmin ? 'Guardado.' : 'Listo. El dueño ya lo ve en su panel.'}
        </p>
        <button className="big" onClick={onClose}>Listo</button>
      </Sheet>
    );

  return (
    <Sheet onClose={onClose}>
      <div>
        <h1>{esAdmin ? 'Nueva venta' : 'Anotar corte'}</h1>
        <p className="sub">El número de papelito se asigna al guardar</p>
      </div>

      {esAdmin && barberos && (
        <div className="field">
          <label htmlFor="f-vb">Barbero</label>
          <select id="f-vb" value={barberoId} onChange={(e) => setBarberoId(e.target.value)}>
            {barberos.filter((b) => b.activo).map((b) => (
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="eyebrow">Servicio</span>
        <div className="opt">
          {servicios.map((s) => (
            <button key={s.id} aria-pressed={servicioId === s.id} onClick={() => setServicioId(servicioId === s.id ? null : s.id)}>
              <span className="k">{s.nombre}</span>
              <span className="p">{fmt(s.precio)}</span>
            </button>
          ))}
        </div>
      </div>

      {productos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eyebrow">Productos vendidos</span>
          <div className="list card" style={{ padding: '10px 14px', boxShadow: 'none' }}>
            {productos.map((p) => {
              const n = prods[p.id] ?? 0;
              return (
                <div className="li" key={p.id}>
                  <div className="grow">
                    <div className="name" style={{ fontWeight: 500 }}>{p.nombre}</div>
                    <div className="small">{fmt(p.precio)} · stock {p.stock}</div>
                  </div>
                  <div className="qty">
                    <button onClick={() => cambiarCant(p.id, -1)} disabled={!n} aria-label={'Quitar ' + p.nombre}>−</button>
                    <span>{n}</span>
                    <button onClick={() => cambiarCant(p.id, 1)} disabled={n >= p.stock} aria-label={'Agregar ' + p.nombre}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subtotal > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eyebrow">¿Cómo paga?</span>
          <div className="opt">
            <button aria-pressed={metodo === 'efectivo'} onClick={() => setMetodo('efectivo')}>
              <span className="k"><i className="dot ef" />Efectivo</span>
              <span className="p">{fmt(subtotal)}</span>
              <span className="x">{esAdmin ? 'Entra a la caja' : 'Te lo da a vos'}</span>
            </button>
            <button aria-pressed={metodo === 'transferencia'} onClick={() => setMetodo('transferencia')}>
              <span className="k"><i className="dot tr" />Transferencia</span>
              <span className="p">{fmt(conRecargo)}</span>
              <span className="x">Con {config.recargoPct}% de recargo</span>
            </button>
          </div>
          {metodo === 'transferencia' && (
            <label className="check">
              <input type="checkbox" checked={visto} onChange={(e) => setVisto(e.target.checked)} />
              <span>
                <b>Vi el comprobante</b>
                <br />
                <span className="small">Transfirió {fmt(conRecargo)}. El dueño lo confirma después en el banco.</span>
              </span>
            </label>
          )}
        </div>
      )}

      {error && <div className="pill bad" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{error}</div>}
      <button className="big" onClick={guardar} disabled={!ok}>
        {I.plus}
        {guardando ? 'Guardando…' : 'Guardar papelito' + (subtotal ? ' · ' + fmt(total) : '')}
      </button>
      <button className="btn ghost" onClick={onClose}>Cancelar</button>
    </Sheet>
  );
}
