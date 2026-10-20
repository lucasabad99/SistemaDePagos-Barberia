import { useAuth } from '../lib/auth';
import { Logo } from '../Logo';

// Placeholder: acá van a ir "Hoy" (anotar corte, mis papelitos) y "Mis números".
export function BarberoHome() {
  const { usuario, logout } = useAuth();
  return (
    <div className="phone">
      <header className="ptop">
        <Logo className="lg" />
        <div className="grow">
          <b>{usuario!.nombre}</b>
          <small>Barbero · {usuario!.comision}% de comisión</small>
        </div>
        <button onClick={logout}>Salir</button>
      </header>
      <div className="pcontent">
        <h1>Hola, {usuario!.nombre}</h1>
        <p className="sub">Login funcionando. Próximo paso: anotar cortes.</p>
      </div>
    </div>
  );
}
