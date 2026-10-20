import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { AdminHome } from './pages/AdminHome';
import { BarberoHome } from './pages/BarberoHome';

export function App() {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Login />;
  return usuario.rol === 'admin' ? <AdminHome /> : <BarberoHome />;
}
