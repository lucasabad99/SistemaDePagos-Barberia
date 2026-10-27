import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Logo } from '../Logo';

export function Login() {
  const { login, aviso } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(usuario, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
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
      </form>
    </div>
  );
}
