import { Local, Usuario } from '../../lib/api';
import { Logo } from '../../Logo';
import { I } from '../../components/Icons';

// Lo primero que ve el dueño al entrar: en qué local va a trabajar.
export function ElegirLocal({
  me,
  locales,
  actual,
  onElegir,
  onSalir,
}: {
  me: Usuario;
  locales: Local[] | null;
  actual?: string | null;
  onElegir: (l: Local) => void;
  onSalir: () => void;
}) {
  return (
    <div className="login elegir">
      <div className="login-box">
        <div className="logo">
          <Logo />
          <b>Hola, {me.nombre}</b>
          <span>¿En qué local vas a trabajar?</span>
        </div>
        {!locales ? (
          <p className="sub" style={{ textAlign: 'center' }}>Cargando locales…</p>
        ) : (
          <div className="locales">
            {locales.map((l) => (
              <button key={l.id} type="button" onClick={() => onElegir(l)} aria-current={l.id === actual ? 'true' : undefined}>
                <span className="ic">{I.local}</span>
                <span className="grow">
                  <b>Local {l.nombre}</b>
                  <small>{l.id === actual ? 'Estás acá' : 'Entrar'}</small>
                </span>
                <span aria-hidden>›</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="salir" onClick={onSalir}>
          Salir
        </button>
      </div>
    </div>
  );
}
