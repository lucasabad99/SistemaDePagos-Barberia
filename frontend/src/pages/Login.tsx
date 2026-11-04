import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

interface UsuarioDemo {
  nombre: string;
  usuario: string;
  pin: string;
  rol: 'admin' | 'barbero';
  local: string | null;
}
import { Logo } from '../Logo';
import { InstalarApp } from '../components/Pwa';

export function Login() {
  const { login, aviso } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Solo en local/staging el servidor devuelve los usuarios de ejemplo; en producción, nada.
  const [demo, setDemo] = useState<UsuarioDemo[]>([]);
  useEffect(() => {
    api<{ usuarios: UsuarioDemo[] }>('/auth/demo')
      .then((r) => setDemo(r.usuarios))
      .catch(() => setDemo([]));
  }, []);

  async function entrar(u: string, p: string) {
    setError('');
    setEnviando(true);
    try {
      await login(u, p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    entrar(usuario, pin);
  }

  function entrarComo(d: UsuarioDemo) {
    setUsuario(d.usuario);
    setPin(d.pin);
    entrar(d.usuario, d.pin);
  }

  return (
    <div className="login">
      <form className="login-box" onSubmit={onSubmit} noValidate>
        <div className="logo">
          <Logo />
          <b>Papelito Barbería</b>
          <span>Controlá tu barbería, sin papelitos.</span>
        </div>
        <div className="lfield">
          <div>
            <label htmlFor="l-user">Usuario</label>
            <input id="l-user" autoComplete="username" autoCapitalize="none" placeholder="Ingresá tu usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </div>
        </div>
        <div className="lfield">
          <div>
            <label htmlFor="l-pin">PIN</label>
            <input id="l-pin" type="password" inputMode="numeric" autoComplete="current-password" placeholder="4 números" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
        </div>
        <div className="lerr" role="alert">{error || aviso}</div>
        <button className="lbtn" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
        <div style={{ textAlign: 'center' }}>
          <InstalarApp />
        </div>
        {demo.length > 0 && (
          <div className="quick">
            <p>Entorno de prueba · entrá rápido como</p>
            <div className="row">
              {demo.map((d) => (
                <button key={d.usuario} type="button" onClick={() => entrarComo(d)} disabled={enviando} title={`Usuario ${d.usuario} · PIN ${d.pin}`}>
                  {d.nombre} <b>{d.rol === 'admin' ? 'dueño' : d.local ?? 'barbero'}</b>
                </button>
              ))}
            </div>
            <p>
              {demo.map((d) => `${d.usuario} / ${d.pin}`).join(' · ')}
            </p>
          </div>
        )}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', margin: 0 }}>Versión {__VERSION__}</p>
      </form>
    </div>
  );
}
