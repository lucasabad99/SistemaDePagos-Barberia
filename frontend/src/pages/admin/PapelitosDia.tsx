import { useState } from 'react';
import { api, Catalogo, EnMano, post, Usuario, Venta } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { dayKey, dayRange, fmt, initials, longDate, sum } from '../../lib/format';
import { useData } from '../../lib/useData';
import { I } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { descripcion, EstadoPill, Ticket } from '../../components/Ticket';
import { DayNav } from '../../components/DayNav';
import { VentaSheet } from '../../components/VentaSheet';

type Hoja = { tipo: 'venta' } | { tipo: 'recibir'; barbero: Usuario } | { tipo: 'detalle'; venta: Venta } | null;

const POLL = 20_000; // refresco automático para ver los papelitos nuevos de los barberos

export function PapelitosDia() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [dia, setDia] = useState(dayKey());
  const [filtro, setFiltro] = useState<string>('all');
  const [hoja, setHoja] = useState<Hoja>(null);
  const esHoy = dia === dayKey();

  const catalogo = useData(() => api<Catalogo>('/catalogo'), []);
  const usuarios = useData(() => api<{ usuarios: Usuario[] }>('/usuarios'), []);
  const ventas = useData(
    () => {
      const { desde, hasta } = dayRange(dia);
      return api<{ ventas: Venta[] }>(`/ventas?desde=${desde}&hasta=${hasta}`);
    },
    [dia],
    esHoy ? POLL : undefined,
  );
  const mano = useData(() => api<{ enMano: EnMano[] }>('/ventas/en-mano'), [], POLL);
  const pendientes = useData(() => api<{ ventas: Venta[] }>('/ventas?estado=pendiente'), [], POLL);

  const recargar = () => {
    ventas.reload();
    mano.reload();
    pendientes.reload();
    catalogo.reload();
  };

  const todas = ventas.data?.ventas ?? [];
  const validas = todas.filter((v) => v.estado !== 'anulada');
  const lista = filtro === 'all' ? todas : todas.filter((v) => v.barbero.id === filtro);
  const equipo = usuarios.data?.usuarios ?? [];
  const barberos = equipo.filter((u) => u.rol === 'barbero');
  const enManoDe = (id: string) => mano.data?.enMano.find((m) => m.barberoId === id);
  const pend = pendientes.data?.ventas ?? [];

  const efectivo = sum(validas.filter((v) => v.metodo === 'efectivo'), (v) => v.total);
  const transf = sum(validas.filter((v) => v.metodo === 'transferencia'), (v) => v.total);
  const comisiones = sum(validas, (v) => v.comision);
  const servicios = sum(validas, (v) => v.items.filter((x) => x.tipo === 'servicio').length);

  // Resumen por persona: el reemplazo del "contar papelitos" al final del día.
  const porPersona = equipo
    .map((u) => {
      const vs = validas.filter((v) => v.barbero.id === u.id);
      return {
        u,
        servicios: sum(vs, (v) => v.items.filter((x) => x.tipo === 'servicio').length),
        efectivo: sum(vs.filter((v) => v.metodo === 'efectivo'), (v) => v.total),
        transf: sum(vs.filter((v) => v.metodo === 'transferencia'), (v) => v.total),
        comision: sum(vs, (v) => v.comision),
        n: vs.length,
      };
    })
    .filter((x) => x.n > 0);

  async function verificar(v: Venta) {
    try {
      await post(`/ventas/${v.id}/verificar`);
      toast(`Nº${v.num}: transferencia acreditada`);
      setHoja(null);
      recargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Papelitos del día</h1>
          <p className="sub">{longDate(dia)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <DayNav value={dia} onChange={setDia} />
          <button className="btn gold" onClick={() => setHoja({ tipo: 'venta' })} disabled={!catalogo.data || !usuarios.data}>
            {I.plus}Nueva venta
          </button>
        </div>
      </div>

      {ventas.error && <div className="demo">{ventas.error}</div>}

      <div className="grid kpis">
        <Kpi l="Total cobrado" v={fmt(efectivo + transf)} ic="money" cls="ok" d={`${validas.length} papelitos · ${servicios} servicios`} />
        <Kpi l="Efectivo" v={fmt(efectivo)} ic="caja" cls="gold" />
        <Kpi l="Transferencias" v={fmt(transf)} ic="ventas" cls="blue" d={`incluye ${fmt(sum(validas, (v) => v.recargo))} de recargo`} />
        <Kpi l="Comisiones" v={fmt(comisiones)} ic="barberos" cls="warn" d={`queda ${fmt(efectivo + transf - comisiones)} para la barbería`} />
      </div>

      <div className="grid g2">
        <div className="card">
          <CardH t="Efectivo que tienen los barberos" ic="barberos" cls="warn" />
          <div className="list">
            {barberos.map((b) => {
              const m = enManoDe(b.id);
              return (
                <div className="li" key={b.id}>
                  <span className="avatar">{initials(b.nombre)}</span>
                  <div className="grow">
                    <div className="name">{b.nombre}</div>
                    <div className="small">{m ? `${m.cantidad} papelito${m.cantidad > 1 ? 's' : ''} sin entregar` : 'Entregó todo'}</div>
                  </div>
                  {m ? (
                    <button className="btn okb sm num" onClick={() => setHoja({ tipo: 'recibir', barbero: b })}>Recibí {fmt(m.total)}</button>
                  ) : (
                    <span className="pill ok">Al día</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <CardH t="Transferencias para confirmar" ic="ventas" cls="blue" right={<span className="pill blue">{pend.length}</span>} />
          {pend.length ? (
            <>
              <p className="small" style={{ margin: 0 }}>Tocá el papelito cuando veas la plata en tu cuenta.</p>
              <div className="tickets">
                {pend.map((v) => (
                  <Ticket key={v.id} v={v} onClick={() => setHoja({ tipo: 'detalle', venta: v })} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty">Todas las transferencias están confirmadas.</div>
          )}
        </div>
      </div>

      {porPersona.length > 0 && (
        <div className="card">
          <h2>Resumen por barbero</h2>
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
                {porPersona.map((x) => (
                  <tr key={x.u.id}>
                    <td>{x.u.nombre}</td>
                    <td className="r mono">{x.servicios}</td>
                    <td className="r mono">{fmt(x.efectivo)}</td>
                    <td className="r mono">{fmt(x.transf)}</td>
                    <td className="r mono">{x.u.rol === 'admin' ? '—' : fmt(x.comision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="chips">
          {[{ id: 'all', nombre: 'Todos' }, ...equipo].map((u) => (
            <button key={u.id} aria-pressed={filtro === u.id} onClick={() => setFiltro(u.id)}>{u.nombre}</button>
          ))}
        </div>
        {!ventas.data && !ventas.error ? (
          <div className="empty">Cargando…</div>
        ) : lista.length ? (
          <div className="tickets">
            {lista.map((v) => (
              <Ticket key={v.id} v={v} onClick={() => setHoja({ tipo: 'detalle', venta: v })} />
            ))}
          </div>
        ) : (
          <div className="empty">No hay papelitos {esHoy ? 'todavía hoy' : 'ese día'}.</div>
        )}
      </div>

      {hoja?.tipo === 'venta' && catalogo.data && (
        <VentaSheet
          catalogo={catalogo.data}
          esAdmin
          meId={usuario!.id}
          barberos={equipo}
          onClose={() => setHoja(null)}
          onSaved={() => {
            setDia(dayKey());
            recargar();
          }}
        />
      )}
      {hoja?.tipo === 'recibir' && (
        <RecibirSheet
          barbero={hoja.barbero}
          onClose={() => setHoja(null)}
          onDone={(total) => {
            toast(`Recibiste ${fmt(total)} de ${hoja.barbero.nombre}`);
            setHoja(null);
            recargar();
          }}
        />
      )}
      {hoja?.tipo === 'detalle' && (
        <DetalleSheet
          v={hoja.venta}
          onClose={() => setHoja(null)}
          onVerificar={() => verificar(hoja.venta)}
          onAnulada={() => {
            toast(`Nº${hoja.venta.num} anulado`);
            setHoja(null);
            recargar();
          }}
        />
      )}
    </>
  );
}

/* ---------- Piezas ---------- */
function Kpi({ l, v, ic, cls, d }: { l: string; v: string; ic: keyof typeof I; cls: string; d?: string }) {
  return (
    <div className="card kpi">
      <div className="row">
        <span className="l">{l}</span>
        <span className="card-h"><span className={'ic ' + cls}>{I[ic]}</span></span>
      </div>
      <div className="v">{v}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

function CardH({ t, ic, cls, right }: { t: string; ic: keyof typeof I; cls: string; right?: React.ReactNode }) {
  return (
    <div className="card-h">
      <div className="t">
        <span className={'ic ' + cls}>{I[ic]}</span>
        <h2>{t}</h2>
      </div>
      {right}
    </div>
  );
}

function RecibirSheet({ barbero, onClose, onDone }: { barbero: Usuario; onClose: () => void; onDone: (total: number) => void }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const { data } = useData(() => api<{ ventas: Venta[] }>(`/ventas?estado=en_barbero&barberoId=${barbero.id}`), [barbero.id]);
  const lista = data?.ventas ?? [];

  async function confirmar() {
    setEnviando(true);
    try {
      const r = await post<{ total: number }>('/ventas/recibir', { barberoId: barbero.id });
      onDone(r.total);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div>
        <h1>Recibir efectivo</h1>
        <p className="sub">{barbero.nombre} te entrega la plata de estos papelitos</p>
      </div>
      <div className="tickets">
        {lista.map((v) => (
          <Ticket key={v.id} v={v} barbero={false} />
        ))}
      </div>
      <div className="card">
        <div className="ledger">
          <span className="tot">Tenés que recibir</span>
          <span className="r tot">{fmt(sum(lista, (v) => v.total))}</span>
        </div>
      </div>
      <button className="big" onClick={confirmar} disabled={!data || !lista.length || enviando}>Contado y recibido</button>
      <button className="btn ghost" onClick={onClose}>Cancelar</button>
    </Sheet>
  );
}

function DetalleSheet({ v, onClose, onVerificar, onAnulada }: { v: Venta; onClose: () => void; onVerificar: () => void; onAnulada: () => void }) {
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');

  async function anular() {
    try {
      await post(`/ventas/${v.id}/anular`, { motivo });
      onAnulada();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="bigticket">
        <span className="small">Papelito</span>
        <span className="n">Nº{v.num}</span>
        <span className="small">
          {v.barbero.nombre} · {new Date(v.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
        <div style={{ marginTop: 6 }}><EstadoPill v={v} /></div>
      </div>
      <div className="card">
        <div className="ledger">
          {v.items.map((x, i) => (
            <span key={i} style={{ display: 'contents' }}>
              <span>{x.nombre}{x.cant > 1 ? ` ×${x.cant}` : ''}</span>
              <span className="r">{fmt(x.precio * x.cant)}</span>
            </span>
          ))}
          {v.recargo > 0 && (
            <>
              <span>Recargo transferencia</span>
              <span className="r">{fmt(v.recargo)}</span>
            </>
          )}
          <span className="tot">Cobrado ({v.metodo})</span>
          <span className="r tot">{fmt(v.total)}</span>
          {v.barbero.rol !== 'admin' && (
            <>
              <span className="small">Comisión de {v.barbero.nombre}</span>
              <span className="r small">{fmt(v.comision)}</span>
            </>
          )}
        </div>
      </div>
      {v.estado === 'anulada' && v.motivoAnulacion && <div className="note"><b>Motivo:</b> {v.motivoAnulacion}</div>}

      {v.estado === 'pendiente' && (
        <button className="big" onClick={onVerificar}>Ya la vi en el banco · {fmt(v.total)}</button>
      )}
      {v.estado !== 'anulada' &&
        (confirmando ? (
          <div className="card" style={{ borderColor: 'var(--bad)' }}>
            <div className="field">
              <label htmlFor="f-mot">Motivo (opcional)</label>
              <input id="f-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: lo anotó dos veces" maxLength={200} />
            </div>
            <p className="small" style={{ margin: 0 }}>
              “{descripcion(v)}” deja de contar en caja y comisiones. Los productos vuelven al stock.
            </p>
            <button className="btn danger" onClick={anular}>Anular papelito Nº{v.num}</button>
          </div>
        ) : (
          <button className="btn danger" onClick={() => setConfirmando(true)}>Anular papelito</button>
        ))}
      <button className="btn ghost" onClick={onClose}>Cerrar</button>
    </Sheet>
  );
}
