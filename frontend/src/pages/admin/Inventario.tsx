import { FormEvent, useState } from 'react';
import { api, Local, MovimientoStock, patch, post, ProductoInv } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { fmt, plural, sum } from '../../lib/format';
import { useData } from '../../lib/useData';
import { I } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';

type Hoja =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; p: ProductoInv }
  | { tipo: 'stock'; p: ProductoInv; modo: 'ingreso' | 'ajuste' }
  | { tipo: 'historial'; p: ProductoInv }
  | null;
type Filtro = 'todos' | 'reponer' | 'baja';

const bajo = (p: ProductoInv) => p.stock <= p.min;

/** Inventario del local en el que está parado el dueño: productos, stock, entradas y correcciones. */
export function Inventario({ localActual }: { localActual: Local }) {
  const toast = useToast();
  const [hoja, setHoja] = useState<Hoja>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [q, setQ] = useState('');
  const productos = useData(() => api<{ productos: ProductoInv[] }>('/productos').then((r) => r.productos), []);

  const todos = productos.data ?? [];
  const activos = todos.filter((p) => p.activo);
  const reponer = activos.filter(bajo);
  const deBaja = todos.filter((p) => !p.activo);
  const base = filtro === 'reponer' ? reponer : filtro === 'baja' ? deBaja : activos;
  const texto = q.trim().toLowerCase();
  const lista = texto ? base.filter((p) => p.nombre.toLowerCase().includes(texto)) : base;
  const valorStock = fmt(sum(activos, (p) => p.stock * p.costo));

  const listo = (msg: string) => {
    toast(msg);
    setHoja(null);
    productos.reload();
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Inventario</h1>
          <p className="sub">Local {localActual.nombre} · {plural(activos.length, 'producto')} a la venta</p>
        </div>
        <button className="btn gold" onClick={() => setHoja({ tipo: 'nuevo' })}>{I.plus}Nuevo producto</button>
      </div>

      {productos.error && <div className="demo">{productos.error}</div>}

      {productos.data && (
        <div className="stats">
          <div className={'stat' + (reponer.length ? ' hot' : '')}>
            <div className="v">{reponer.length}</div>
            <div className="l">Para reponer</div>
          </div>
          <div className="stat">
            <div className="v">{sum(activos, (p) => p.stock)}</div>
            <div className="l">Unidades en el local</div>
          </div>
          <div className="stat">
            <div className="v" style={{ fontSize: valorStock.length > 7 ? 17 : undefined, whiteSpace: 'nowrap' }}>{valorStock}</div>
            <div className="l">En stock, al costo</div>
          </div>
        </div>
      )}

      {todos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="chips">
            <button aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>A la venta ({activos.length})</button>
            <button aria-pressed={filtro === 'reponer'} onClick={() => setFiltro('reponer')}>Para reponer ({reponer.length})</button>
            {deBaja.length > 0 && (
              <button aria-pressed={filtro === 'baja'} onClick={() => setFiltro('baja')}>Dados de baja ({deBaja.length})</button>
            )}
          </div>
          {todos.length > 6 && <input className="search" type="search" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />}
        </div>
      )}

      {productos.data && !lista.length && (
        <div className="empty">
          {texto
            ? 'No hay productos con ese nombre.'
            : filtro === 'reponer'
              ? 'Nada para reponer: todos los productos están por encima del mínimo.'
              : filtro === 'baja'
                ? 'No hay productos dados de baja.'
                : 'Todavía no cargaste productos. Tocá "Nuevo producto".'}
        </div>
      )}

      <div className="grid g3">
        {lista.map((p) => (
          <ProductoCard key={p.id} p={p} onHoja={setHoja} />
        ))}
      </div>

      <div className="note">
        <b>Los productos son los mismos en los dos locales</b> (mismo nombre y precio), pero <b>cada local tiene su stock</b>. Acá ves y movés el stock del local {localActual.nombre}.
        <ul>
          <li><b>Entró mercadería:</b> suma al stock lo que compraste o trajiste.</li>
          <li><b>Corregir:</b> cuando contás y hay otra cantidad (se rompió, se usó en el local, se perdió). Se anota la diferencia.</li>
          <li>Cada venta descuenta sola y si anulás un papelito el producto vuelve. Todo queda en el <b>historial</b>.</li>
          <li>Si dejás de vender un producto, <b>dalo de baja</b> desde Editar: no aparece más al anotar, pero el historial queda.</li>
        </ul>
      </div>

      {hoja?.tipo === 'nuevo' && (
        <ProductoSheet localActual={localActual} onClose={() => setHoja(null)} onDone={(p) => listo(`${p.nombre} agregado`)} />
      )}
      {hoja?.tipo === 'editar' && (
        <ProductoSheet
          p={hoja.p}
          localActual={localActual}
          onClose={() => setHoja(null)}
          onDone={(p) => listo(p.activo === hoja.p.activo ? 'Cambios guardados' : p.activo ? `${p.nombre} vuelve a estar a la venta` : `${p.nombre} dado de baja`)}
        />
      )}
      {hoja?.tipo === 'stock' && (
        <StockSheet
          p={hoja.p}
          modoInicial={hoja.modo}
          localActual={localActual}
          onClose={() => setHoja(null)}
          onDone={(p) => listo(`${p.nombre}: quedan ${p.stock} en ${localActual.nombre}`)}
        />
      )}
      {hoja?.tipo === 'historial' && <HistorialSheet p={hoja.p} localActual={localActual} onClose={() => setHoja(null)} />}
    </>
  );
}

function ProductoCard({ p, onHoja }: { p: ProductoInv; onHoja: (h: Hoja) => void }) {
  const low = p.activo && bajo(p);
  const tope = Math.max(p.min * 3, p.stock, 1);
  return (
    <div className="card" style={p.activo ? undefined : { opacity: 0.65 }}>
      <div className="card-h">
        <div className="t">
          <span className={'ic ' + (!p.activo ? 'mute' : low ? 'bad' : 'gold')}>{I.inventario}</span>
          <div style={{ minWidth: 0 }}>
            <h2>{p.nombre}</h2>
            <div className="small">Precio {fmt(p.precio)} · costo {fmt(p.costo)}</div>
          </div>
        </div>
        {!p.activo ? (
          <span className="pill mute">De baja</span>
        ) : p.stock === 0 ? (
          <span className="pill bad">Sin stock</span>
        ) : (
          low && <span className="pill bad">Reponer</span>
        )}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
          <span>Stock <b className="num" style={{ fontSize: 16 }}>{p.stock}</b></span>
          <span className="small">mínimo {p.min}</span>
        </div>
        <div className={'meter' + (low ? ' low' : '')}><i style={{ width: `${Math.min(100, (p.stock / tope) * 100)}%` }} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="small">
          Vendidos este mes: <b className="num" style={{ color: 'var(--ink)' }}>{p.vendidosMes}</b>
          {p.otrosLocales.map((o) => (
            <span key={o.id}> · en {o.nombre}: <b className="num" style={{ color: 'var(--ink)' }}>{o.stock}</b></span>
          ))}
        </div>
        <button className="btn sm ghost" style={{ padding: '4px 2px', textDecoration: 'underline' }} onClick={() => onHoja({ tipo: 'historial', p })}>Historial</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {p.activo && (
          <>
            <button className="btn sm gold" onClick={() => onHoja({ tipo: 'stock', p, modo: 'ingreso' })}>{I.plus}Entró mercadería</button>
            <button className="btn sm" onClick={() => onHoja({ tipo: 'stock', p, modo: 'ajuste' })}>Corregir</button>
          </>
        )}
        <button className="btn sm" onClick={() => onHoja({ tipo: 'editar', p })}>Editar</button>
      </div>
    </div>
  );
}

/* ---------- helpers de formularios ---------- */
const entero = (s: string) => (s.trim() === '' ? NaN : Number(s));
const soloNumeros = (s: string) => s.replace(/[^\d]/g, '');

function NumField({ id, label, value, onChange, hint, prefijo }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; prefijo?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={prefijo && value ? '$ ' + Number(value).toLocaleString('es-AR') : value}
        onChange={(e) => onChange(soloNumeros(e.target.value))}
        placeholder={prefijo ? '$ 0' : '0'}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function ErrorPill({ error }: { error: string }) {
  return error ? <div className="pill bad" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{error}</div> : null;
}

/* ---------- Alta / edición / baja ---------- */
function ProductoSheet({ p, localActual, onClose, onDone }: { p?: ProductoInv; localActual: Local; onClose: () => void; onDone: (p: ProductoInv) => void }) {
  const nuevo = !p;
  const [nombre, setNombre] = useState(p?.nombre ?? '');
  const [precio, setPrecio] = useState(p ? String(p.precio) : '');
  const [costo, setCosto] = useState(p ? String(p.costo) : '');
  const [min, setMin] = useState(p ? String(p.min) : '3');
  const [stock, setStock] = useState('');
  const [activo, setActivo] = useState(p?.activo ?? true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const vPrecio = entero(precio);
  const vCosto = entero(costo) || 0;
  const ganancia = vPrecio - vCosto;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const datos = { nombre, precio: vPrecio, costo: vCosto, min: entero(min) || 0 };
      const r = nuevo
        ? await post<{ producto: ProductoInv }>('/productos', { ...datos, stock: entero(stock) || 0 })
        : await patch<{ producto: ProductoInv }>(`/productos/${p!.id}`, { ...datos, activo });
      onDone(r.producto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>{nuevo ? 'Nuevo producto' : `Editar ${p!.nombre}`}</h1>
          <p className="sub">
            {nuevo
              ? `Aparece en los dos locales con el mismo precio. El stock que pongas es del local ${localActual.nombre}.`
              : 'El nombre y el precio cambian en los dos locales. Los papelitos ya anotados mantienen el precio que tenían.'}
          </p>
        </div>
        <div className="field">
          <label htmlFor="p-nom">Nombre</label>
          <input id="p-nom" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Cera mate" maxLength={50} />
        </div>
        <div className="fields">
          <NumField id="p-pre" label="Precio de venta" value={precio} onChange={setPrecio} prefijo />
          <NumField id="p-cos" label="Costo" value={costo} onChange={setCosto} prefijo hint="Lo que te sale a vos cada uno." />
          <NumField id="p-min" label="Stock mínimo" value={min} onChange={setMin} hint="Con esto o menos, avisa “Reponer”." />
          {nuevo && <NumField id="p-stk" label={`Stock en ${localActual.nombre}`} value={stock} onChange={setStock} hint="Cuántos hay hoy." />}
        </div>
        {vPrecio > 0 && vCosto > 0 && (
          <div className="small" style={{ color: ganancia < 0 ? 'var(--bad)' : undefined }}>
            {ganancia < 0 ? `Ojo: el costo es más alto que el precio (perdés ${fmt(-ganancia)} por unidad)` : `Ganás ${fmt(ganancia)} por unidad (${Math.round((ganancia / vPrecio) * 100)}% del precio)`}
          </div>
        )}
        {!nuevo && (
          <label className="check">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span>
              <b>A la venta</b>
              <br />
              <span className="small">Si lo sacás, no aparece más al anotar un papelito en ningún local. El historial y lo ya vendido quedan guardados.</span>
            </span>
          </label>
        )}
        <ErrorPill error={error} />
        <button className="big" type="submit" disabled={nombre.trim().length < 2 || !(vPrecio >= 0) || enviando}>
          {enviando ? 'Guardando…' : nuevo ? 'Agregar producto' : 'Guardar cambios'}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </Sheet>
  );
}

/* ---------- Entró mercadería / corregir stock ---------- */
function StockSheet({
  p,
  modoInicial,
  localActual,
  onClose,
  onDone,
}: {
  p: ProductoInv;
  modoInicial: 'ingreso' | 'ajuste';
  localActual: Local;
  onClose: () => void;
  onDone: (p: ProductoInv) => void;
}) {
  const [modo, setModo] = useState(modoInicial);
  const [cant, setCant] = useState('');
  const [hay, setHay] = useState(String(p.stock));
  const [costo, setCosto] = useState(String(p.costo || ''));
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const vCant = entero(cant);
  const vHay = entero(hay);
  const dif = vHay - p.stock;
  const valido = modo === 'ingreso' ? vCant > 0 : vHay >= 0 && dif !== 0;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const body =
        modo === 'ingreso'
          ? { tipo: 'ingreso', cant: vCant, ...(costo !== '' && { costo: entero(costo) }), nota }
          : { tipo: 'ajuste', stock: vHay, nota };
      const r = await post<{ producto: ProductoInv }>(`/productos/${p.id}/stock`, body);
      onDone(r.producto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>{p.nombre}</h1>
          <p className="sub">Local {localActual.nombre} · hoy hay <b>{p.stock}</b></p>
        </div>
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          <button type="button" aria-pressed={modo === 'ingreso'} onClick={() => setModo('ingreso')}>Entró mercadería</button>
          <button type="button" aria-pressed={modo === 'ajuste'} onClick={() => setModo('ajuste')}>Corregir</button>
        </div>
        {modo === 'ingreso' ? (
          <div className="fields">
            <NumField id="s-cant" label="¿Cuántos entraron?" value={cant} onChange={setCant} hint={vCant > 0 ? `Van a quedar ${p.stock + vCant}` : undefined} />
            <NumField id="s-cos" label="Costo por unidad" value={costo} onChange={setCosto} prefijo hint="Si cambió, se actualiza el costo del producto." />
          </div>
        ) : (
          <NumField
            id="s-hay"
            label="¿Cuántos hay en realidad?"
            value={hay}
            onChange={setHay}
            hint={Number.isNaN(vHay) ? 'Contá los que hay en el local.' : dif === 0 ? 'Es lo mismo que dice la app.' : dif < 0 ? `Faltan ${-dif}` : `Sobran ${dif}`}
          />
        )}
        <div className="field">
          <label htmlFor="s-nota">{modo === 'ingreso' ? 'Proveedor o nota (opcional)' : 'Motivo (opcional)'}</label>
          <input id="s-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder={modo === 'ingreso' ? 'Ej: Distribuidora Sur' : 'Ej: se rompió uno, uso del local'} />
        </div>
        <ErrorPill error={error} />
        <button className="big" type="submit" disabled={!valido || enviando}>
          {enviando ? 'Guardando…' : modo === 'ingreso' ? 'Sumar al stock' : 'Corregir stock'}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </Sheet>
  );
}

/* ---------- Historial ---------- */
const ETIQUETA: Record<MovimientoStock['tipo'], string> = {
  ingreso: 'Entró mercadería',
  ajuste: 'Corrección',
  venta: 'Vendido',
  anulacion: 'Papelito anulado',
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace('.', '');

function HistorialSheet({ p, localActual, onClose }: { p: ProductoInv; localActual: Local; onClose: () => void }) {
  const movs = useData(() => api<{ movimientos: MovimientoStock[] }>(`/productos/${p.id}/movimientos`).then((r) => r.movimientos), [p.id]);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>Historial de {p.nombre}</h1>
          <p className="sub">Local {localActual.nombre} · hoy hay {p.stock}</p>
        </div>
        {movs.error && <div className="demo">{movs.error}</div>}
        {movs.data && !movs.data.length && <div className="empty">Todavía no hubo movimientos en este local.</div>}
        {movs.data && movs.data.length > 0 && (
          <div>
            {movs.data.map((m) => (
              <div className="li" key={m.id}>
                <div className="grow">
                  <div className="name" style={{ fontWeight: 500 }}>
                    {ETIQUETA[m.tipo]}
                    {m.num != null && <span className="small"> · papelito #{m.num}</span>}
                  </div>
                  <div className="small">
                    {fechaHora(m.fecha)}
                    {m.usuario && ` · ${m.usuario.nombre}`}
                    {m.costo != null && ` · ${fmt(m.costo)} c/u`}
                    {m.nota && ` · ${m.nota}`}
                  </div>
                </div>
                <div className="r">
                  <b className="num" style={{ color: m.cant > 0 ? 'var(--ok)' : m.cant < 0 ? 'var(--bad)' : undefined }}>
                    {m.cant > 0 ? '+' : m.cant < 0 ? '−' : ''}
                    {Math.abs(m.cant)}
                  </b>
                  {m.stock != null && <div className="small">quedan {m.stock}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn ghost" type="button" onClick={onClose}>Cerrar</button>
      </div>
    </Sheet>
  );
}
