import { FormEvent, useState } from 'react';
import { api, EnMano, patch, post, Usuario, Venta } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { fmt, initials, sum } from '../../lib/format';
import { useData } from '../../lib/useData';
import { I } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { CambiarPinSheet, PinField } from '../../components/CambiarPinSheet';

type Hoja = { tipo: 'nuevo' } | { tipo: 'editar'; u: Usuario } | { tipo: 'pin'; u: Usuario } | { tipo: 'miPin' } | null;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function Barberos() {
  const { usuario: yo, recargarYo } = useAuth();
  const toast = useToast();
  const [hoja, setHoja] = useState<Hoja>(null);

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  const usuarios = useData(() => api<{ usuarios: Usuario[] }>('/usuarios'), []);
  const ventasMes = useData(() => api<{ ventas: Venta[] }>(`/ventas?desde=${inicioMes}`), [inicioMes]);
  const mano = useData(() => api<{ enMano: EnMano[] }>('/ventas/en-mano'), []);

  const lista = usuarios.data?.usuarios ?? [];
  const ventas = (ventasMes.data?.ventas ?? []).filter((v) => v.estado !== 'anulada');
  const activos = lista.filter((u) => u.rol === 'barbero' && u.activo).length;

  const recargar = () => {
    usuarios.reload();
    recargarYo();
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Barberos</h1>
          <p className="sub">{activos} barbero{activos === 1 ? '' : 's'} activo{activos === 1 ? '' : 's'} · números de {MESES[ahora.getMonth()]}</p>
        </div>
        <button className="btn gold" onClick={() => setHoja({ tipo: 'nuevo' })}>{I.plus}Agregar barbero</button>
      </div>

      {usuarios.error && <div className="demo">{usuarios.error}</div>}

      <div className="grid g3">
        {lista.map((u) => {
          const vs = ventas.filter((v) => v.barbero.id === u.id);
          const servicios = sum(vs, (v) => v.items.filter((x) => x.tipo === 'servicio').length);
          const productos = sum(vs, (v) => sum(v.items.filter((x) => x.tipo === 'producto'), (x) => x.cant));
          const enMano = mano.data?.enMano.find((m) => m.barberoId === u.id);
          const esYo = u.id === yo?.id;
          return (
            <div className="card" key={u.id} style={u.activo ? undefined : { opacity: 0.6 }}>
              <div className="li" style={{ padding: 0, border: 0 }}>
                <span className="avatar">{initials(u.nombre)}</span>
                <div className="grow">
                  <div className="name">{u.nombre}{esYo && ' (vos)'}</div>
                  <div className="small">
                    {u.rol === 'admin' ? 'Dueño' : 'Barbero'} · usuario <span className="mono">{u.usuario}</span>
                  </div>
                </div>
                <span className={'pill ' + (u.activo ? 'ok' : 'mute')}>{u.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="ledger">
                <span>Comisión por servicio</span>
                <span className="r">{u.rol === 'admin' ? '—' : u.comision + '%'}</span>
                <span>Servicios este mes</span>
                <span className="r">{servicios}</span>
                <span>Productos vendidos</span>
                <span className="r">{productos}</span>
                {u.rol !== 'admin' && (
                  <>
                    <span className="tot">Comisión acumulada</span>
                    <span className="r tot">{fmt(sum(vs, (v) => v.comision))}</span>
                  </>
                )}
              </div>
              {enMano && <div className="small" style={{ color: 'var(--warn)' }}>Tiene {fmt(enMano.total)} en efectivo sin entregar</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => setHoja({ tipo: 'editar', u })}>Editar</button>
                {esYo ? (
                  <button className="btn sm" onClick={() => setHoja({ tipo: 'miPin' })}>Cambiar mi PIN</button>
                ) : (
                  <button className="btn sm" onClick={() => setHoja({ tipo: 'pin', u })}>Nuevo PIN</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="note">
        <b>Cada barbero entra con su usuario y PIN</b> y solo ve sus propios papelitos, su comisión y el efectivo que tiene que entregarte.
        No ve la caja, ni a los otros barberos, ni los números del negocio.
        <ul>
          <li>Si un barbero se va, <b>desactivalo</b> en vez de borrarlo: no puede entrar más, pero sus papelitos quedan en el historial.</li>
          <li>Al desactivarlo o ponerle un PIN nuevo, se le cierra la sesión en el momento.</li>
          <li>Cambiar la comisión vale para los papelitos nuevos; los ya anotados mantienen la que tenían.</li>
        </ul>
      </div>

      {hoja?.tipo === 'nuevo' && (
        <UsuarioSheet
          onClose={() => setHoja(null)}
          onDone={(u) => {
            toast(`${u.nombre} ya puede entrar con el usuario "${u.usuario}"`);
            setHoja(null);
            recargar();
          }}
        />
      )}
      {hoja?.tipo === 'editar' && (
        <UsuarioSheet
          u={hoja.u}
          esYo={hoja.u.id === yo?.id}
          onClose={() => setHoja(null)}
          onDone={() => {
            toast('Cambios guardados');
            setHoja(null);
            recargar();
          }}
        />
      )}
      {hoja?.tipo === 'pin' && (
        <ResetPinSheet
          u={hoja.u}
          onClose={() => setHoja(null)}
          onDone={() => {
            toast(`PIN de ${hoja.u.nombre} cambiado`);
            setHoja(null);
          }}
        />
      )}
      {hoja?.tipo === 'miPin' && <CambiarPinSheet onClose={() => setHoja(null)} />}
    </>
  );
}

/* ---------- Alta / edición ---------- */
function UsuarioSheet({ u, esYo, onClose, onDone }: { u?: Usuario; esYo?: boolean; onClose: () => void; onDone: (u: Usuario) => void }) {
  const nuevo = !u;
  const [nombre, setNombre] = useState(u?.nombre ?? '');
  const [usuario, setUsuario] = useState(u?.usuario ?? '');
  const [pin, setPin] = useState('');
  const [comision, setComision] = useState(String(u?.comision ?? 50));
  const [activo, setActivo] = useState(u?.activo ?? true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const esBarbero = !u || u.rol === 'barbero';

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const datos = { nombre, usuario, ...(esBarbero && { comision: Number(comision) || 0 }) };
      const r = nuevo
        ? await post<{ usuario: Usuario }>('/usuarios', { ...datos, pin })
        : await patch<{ usuario: Usuario }>(`/usuarios/${u!.id}`, { ...datos, ...(!esYo && { activo }) });
      onDone(r.usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>{nuevo ? 'Agregar barbero' : `Editar a ${u!.nombre}`}</h1>
          {nuevo && <p className="sub">Después pasale su usuario y PIN para que entre desde el celular.</p>}
        </div>
        <div className="fields">
          <div className="field">
            <label htmlFor="u-nom">Nombre</label>
            <input id="u-nom" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="u-usr">Usuario</label>
            <input id="u-usr" value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" placeholder="Ej: juan" maxLength={20} />
            <span className="hint">Con esto entra a la app. Sin espacios.</span>
          </div>
          {nuevo && <PinField id="u-pin" label="PIN" value={pin} onChange={setPin} autoComplete="new-password" hint="De 4 a 6 números." />}
          {esBarbero && (
            <div className="field">
              <label htmlFor="u-com">Comisión por servicio (%)</label>
              <input id="u-com" type="number" inputMode="numeric" min={0} max={100} value={comision} onChange={(e) => setComision(e.target.value)} />
            </div>
          )}
        </div>
        {!nuevo && !esYo && (
          <label className="check">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span>
              <b>Activo</b>
              <br />
              <span className="small">Si lo desactivás no puede entrar a la app y se le cierra la sesión. Sus papelitos quedan guardados.</span>
            </span>
          </label>
        )}
        {error && <div className="pill bad" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{error}</div>}
        <button className="big" type="submit" disabled={!nombre.trim() || !usuario.trim() || (nuevo && pin.length < 4) || enviando}>
          {enviando ? 'Guardando…' : nuevo ? 'Agregar barbero' : 'Guardar cambios'}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </Sheet>
  );
}

/* ---------- El dueño le pone un PIN nuevo a un barbero ---------- */
function ResetPinSheet({ u, onClose, onDone }: { u: Usuario; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await post(`/usuarios/${u.id}/pin`, { pin });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>Nuevo PIN para {u.nombre}</h1>
          <p className="sub">Para cuando se lo olvida. Se le cierra la sesión y tiene que entrar con el PIN nuevo.</p>
        </div>
        <PinField id="r-pin" label="PIN nuevo" value={pin} onChange={setPin} autoComplete="new-password" hint="De 4 a 6 números. Pasáselo en persona." />
        {error && <div className="pill bad" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{error}</div>}
        <button className="big" type="submit" disabled={pin.length < 4 || enviando}>{enviando ? 'Guardando…' : 'Cambiar PIN'}</button>
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </Sheet>
  );
}
