import { FormEvent, useState } from 'react';
import { api, patch, post, Servicio } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { fmt } from '../../lib/format';
import { useData } from '../../lib/useData';
import { I } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';

type ServicioAdm = Servicio & { activo: boolean };
type Hoja = { tipo: 'nuevo' } | { tipo: 'editar'; s: ServicioAdm } | null;

/** Servicios (corte, barba…) y sus precios. Son los mismos en los dos locales. */
export function Servicios() {
  const toast = useToast();
  const [hoja, setHoja] = useState<Hoja>(null);
  const servicios = useData(() => api<{ servicios: ServicioAdm[] }>('/servicios').then((r) => r.servicios), []);
  const lista = servicios.data ?? [];

  const listo = (msg: string) => {
    toast(msg);
    setHoja(null);
    servicios.reload();
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Servicios</h1>
          <p className="sub">Precios de los dos locales</p>
        </div>
        <button className="btn gold" onClick={() => setHoja({ tipo: 'nuevo' })}>{I.plus}Nuevo servicio</button>
      </div>

      {servicios.error && <div className="demo">{servicios.error}</div>}

      {servicios.data && (
        <div className="card">
          <div className="list">
            {lista.map((s) => (
              <div className="li" key={s.id} style={s.activo ? undefined : { opacity: 0.6 }}>
                <div className="grow">
                  <div className="name">{s.nombre}</div>
                  {!s.activo && <div className="small">Dado de baja</div>}
                </div>
                <b className="num r">{fmt(s.precio)}</b>
                <button className="btn sm" onClick={() => setHoja({ tipo: 'editar', s })}>Editar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="note">
        <b>Cambiar un precio vale para los papelitos nuevos.</b> Los que ya están anotados mantienen el precio que tenían, así no cambian las cuentas ni las comisiones ya hechas.
        Si se paga por transferencia, al precio se le suma el recargo.
      </div>

      {hoja?.tipo === 'nuevo' && <ServicioSheet onClose={() => setHoja(null)} onDone={(s) => listo(`${s.nombre} agregado`)} />}
      {hoja?.tipo === 'editar' && (
        <ServicioSheet
          s={hoja.s}
          onClose={() => setHoja(null)}
          onDone={(s) => listo(s.activo === hoja.s.activo ? `${s.nombre}: ${fmt(s.precio)}` : s.activo ? `${s.nombre} vuelve a estar a la venta` : `${s.nombre} dado de baja`)}
        />
      )}
    </>
  );
}

function ServicioSheet({ s, onClose, onDone }: { s?: ServicioAdm; onClose: () => void; onDone: (s: ServicioAdm) => void }) {
  const nuevo = !s;
  const [nombre, setNombre] = useState(s?.nombre ?? '');
  const [precio, setPrecio] = useState(s ? String(s.precio) : '');
  const [activo, setActivo] = useState(s?.activo ?? true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const datos = { nombre, precio: Number(precio) };
      const r = nuevo
        ? await post<{ servicio: ServicioAdm }>('/servicios', datos)
        : await patch<{ servicio: ServicioAdm }>(`/servicios/${s!.id}`, { ...datos, activo });
      onDone(r.servicio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>{nuevo ? 'Nuevo servicio' : `Editar ${s!.nombre}`}</h1>
          <p className="sub">Vale para los dos locales y para los papelitos que se anoten de ahora en más.</p>
        </div>
        <div className="fields">
          <div className="field">
            <label htmlFor="s-nom">Nombre</label>
            <input id="s-nom" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Corte + barba" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="s-pre">Precio</label>
            <input
              id="s-pre"
              inputMode="numeric"
              value={precio ? '$ ' + Number(precio).toLocaleString('es-AR') : ''}
              onChange={(e) => setPrecio(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="$ 0"
            />
          </div>
        </div>
        {!nuevo && (
          <label className="check">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span>
              <b>A la venta</b>
              <br />
              <span className="small">Si lo sacás, no aparece más al anotar un papelito. Los ya anotados quedan igual.</span>
            </span>
          </label>
        )}
        {error && <div className="pill bad" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{error}</div>}
        <button className="big" type="submit" disabled={nombre.trim().length < 2 || precio === '' || enviando}>
          {enviando ? 'Guardando…' : nuevo ? 'Agregar servicio' : 'Guardar cambios'}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </Sheet>
  );
}
