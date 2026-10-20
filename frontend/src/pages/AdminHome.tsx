import { useAuth } from '../lib/auth';
import { Logo } from '../Logo';

// Placeholder: acá van a ir Inicio, Caja, Ventas, Barberos, Inventario, Impuestos, etc.
export function AdminHome() {
  const { usuario, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <Logo />
          <div>
            <b>Papelito Barbería</b>
            <span>Administración</span>
          </div>
        </div>
        <div className="grow" />
        <div className="me">
          <div className="grow">
            <b>{usuario!.nombre}</b>
            <small>Administrador</small>
          </div>
          <button onClick={logout}>Salir</button>
        </div>
      </aside>
      <main className="content">
        <h1>¡Bienvenido, {usuario!.nombre}!</h1>
        <p className="sub">Login funcionando. Próximo paso: papelitos (ventas) y caja.</p>
      </main>
    </div>
  );
}
