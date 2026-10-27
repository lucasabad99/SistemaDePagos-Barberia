import { useState } from 'react';
import { api, Catalogo, EnMano, Liquidacion, post, Usuario, Venta } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { addDays, dayKey, dayRange, fmt, initials, longDate, monthKey, plural, sum, weekRange, weekStart } from '../../lib/format';
import { useData } from '../../lib/useData';
import { I } from '../../components/Icons';
import { CardH } from '../../components/Card';
import { Sheet } from '../../components/Sheet';
import { descripcion, EstadoPill, Ticket } from '../../components/Ticket';
import { DayNav } from '../../components/DayNav';
import { Calendario } from '../../components/Calendario';
import { VentaSheet } from '../../components/VentaSheet';
import { RecibirSheet } from '../../components/RecibirSheet';

type Hoja = { tipo: 'venta' } | { tipo: 'recibir'; barbero: Usuario } | { tipo: 'detalle'; venta: Venta } | null;

const POLL = 20_000; // refresco automático para ver los papelitos nuevos de los barberos

/** Pantalla principal del dueño: qué tiene que pagar, qué tiene pendiente hoy y los papelitos del día. */
export function PapelitosDia({ irAPagos }: { irAPagos: (lunes?: string) => void }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const [dia, setDia] = useState(dayKey());
  const [mes, setMes] = useState(monthKey());
  const [verCalendario, setVerCalendario] = useState(false);
  const [filtro, setFiltro] = useState<string>('all');
  const [hoja, setHoja] = useState<Hoja>(null);
  const esHoy = dia === dayKey();

  const lunes = weekStart();
  const lunesPasado = addDays(lunes, -7);
  const liquidacionDe = (l: string) => {
    const r = weekRange(l);
    return api<{ barberos: Liquidacion[]; total: number }>(`/liquidacion?desde=${r.desde}&hasta=${r.hasta}`);
  };

  const catalogo = useData(() => api<Catalogo>('/catalogo'), []);
  const usuarios = useData(() => api<{ usuarios: Usuario[] }>('/usuarios'), []);
  const semana = useData(() => liquidacionDe(lunes), [lunes], POLL);
  const pasada = useData(() => liquidacionDe(lunesPasado), [lunesPasado]);
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
    semana.reload();
    ventas.reload();
    mano.reload();
    pendientes.reload();
    catalogo.reload();
  };

  const equipo = usuarios.data?.usuarios ?? [];
  const nombreDe = (id: string) => equipo.find((u) => u.id === id);
  const conEfectivo = (mano.data?.enMano ?? []).map((m) => ({ ...m, u: nombreDe(m.barberoId) })).filter((m) => m.u);
  const pend = pendientes.data?.ventas ?? [];
  const todas = ventas.data?.ventas ?? [];
  const validas = todas.filter((v) => v.estado !== 'anulada');
  const lista = filtro === 'all' ? todas : todas.filter((v) => v.barbero.id === filtro);
  const filasSemana = (semana.data?.barberos ?? []).filter((b) => b.comision > 0 || b.saldo !== 0);
  const debePasada = pasada.data?.total ?? 0;

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
          <h1>Hoy</h1>
          <p className="sub">{longDate(dayKey())}</p>
        </div>
        <button className="btn gold" onClick={() => setHoja({ tipo: 'venta' })} disabled={!catalogo.data || !usuarios.data}>
          {I.plus}Nueva venta
        </button>
      </div>

      {/* 1. Lo que hay que pagar: lo más importante, arriba y en grande */}
      <div className="card hero">
        <div>
          <div className="lbl">A pagar esta semana</div>
          <div className="monto">{semana.data ? fmt(semana.data.total) : '…'}</div>
          <div className="small">Comisiones de los barberos, de lunes a domingo</div>
        </div>
        {filasSemana.length > 0 ? (
          <div className="list">
            {filasSemana.map((b) => (
              <div className="li" key={b.barbero.id}>
                <span className="avatar">{initials(b.barbero.nombre)}</span>
                <div className="grow">
                  <div className="name">{b.barbero.nombre}</div>
                  <div className="small">
                    {plural(sum(b.servicios, (s) => s.cant), 'servicio')}
                    {b.enMano.total > 0 && <span style={{ color: 'var(--warn)' }}> · tiene {fmt(b.enMano.total)} sin entregar</span>}
                  </div>
                </div>
                {b.saldo > 0 ? <span className="amt">{fmt(b.saldo)}</span> : <span className="pill ok">Pagado</span>}
              </div>
            ))}
          </div>
        ) : (
          semana.data && <div className="small">Todavía no hay comisiones esta semana.</div>
        )}
        {debePasada > 0 && (
          <button className="btn" style={{ borderColor: 'var(--warn)', color: 'var(--warn)', alignSelf: 'flex-start' }} onClick={() => irAPagos(lunesPasado)}>
            De la semana pasada quedan {fmt(debePasada)} sin pagar ›
          </button>
        )}
        <button className="btn dark" style={{ alignSelf: 'flex-start' }} onClick={() => irAPagos()}>Ver detalle y pagar ›</button>
      </div>

      {/* 2. Lo que hay que hacer hoy */}
      {conEfectivo.length || pend.length ? (
        <div className="grid g2">
          {conEfectivo.length > 0 && (
            <div className="card">
              <CardH t="Efectivo para recibir" ic="caja" cls="warn" />
              <div className="list">
                {conEfectivo.map((m) => (
                  <div className="li" key={m.barberoId}>
                    <span className="avatar">{initials(m.u!.nombre)}</span>
                    <div className="grow">
                      <div className="name">{m.u!.nombre}</div>
                      <div className="small">{m.cantidad} papelito{m.cantidad > 1 ? 's' : ''} en efectivo</div>
                    </div>
                    <button className="btn okb sm num" onClick={() => setHoja({ tipo: 'recibir', barbero: m.u! })}>Recibí {fmt(m.total)}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pend.length > 0 && (
            <div className="card">
              <CardH t="Transferencias para confirmar" ic="ventas" cls="blue" right={<span className="pill blue">{pend.length}</span>} />
              <p className="small" style={{ margin: 0 }}>Tocá el papelito cuando veas la plata en tu cuenta.</p>
              <div className="tickets">
                {pend.map((v) => (
                  <Ticket key={v.id} v={v} onClick={() => setHoja({ tipo: 'detalle', venta: v })} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        mano.data && pendientes.data && (
          <div className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span className="pill ok">Al día</span>
            <span className="small">No hay efectivo por recibir ni transferencias por confirmar.</span>
          </div>
        )
      )}

      {/* 3. Papelitos del día, con calendario para ir a cualquier fecha */}
      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2>Papelitos</h2>
            <div className="small">
              {validas.length} papelito{validas.length === 1 ? '' : 's'} · {fmt(sum(validas, (v) => v.total))} cobrado
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <DayNav value={dia} onChange={(d) => { setDia(d); setMes(monthKey(d)); }} />
            <button className="btn sm" aria-pressed={verCalendario} onClick={() => setVerCalendario(!verCalendario)}>
              {I.liquidacion}{verCalendario ? 'Ocultar calendario' : 'Calendario'}
            </button>
          </div>
        </div>
        {verCalendario && (
          <>
            <Calendario mes={mes} onMes={setMes} seleccionado={dia} onSelect={setDia} marcarPendientes render={(d) => d.papelitos} />
            <div className="legend">
              <span><i style={{ background: 'var(--gold-soft)' }} />Días con papelitos (cantidad)</span>
              <span><i style={{ background: 'var(--blue)', borderRadius: '50%' }} />Transferencias sin confirmar</span>
            </div>
          </>
        )}
        <div className="chips">
          {[{ id: 'all', nombre: 'Todos' }, ...equipo.filter((u) => u.activo || todas.some((v) => v.barbero.id === u.id))].map((u) => (
            <button key={u.id} aria-pressed={filtro === u.id} onClick={() => setFiltro(u.id)}>{u.nombre}</button>
          ))}
        </div>
        {ventas.error && <div className="demo">{ventas.error}</div>}
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
