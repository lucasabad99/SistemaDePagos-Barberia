import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { AdminHome } from './pages/AdminHome';
import { BarberoHome } from './pages/BarberoHome';
import { AvisoVersionNueva } from './components/Pwa';

export function App() {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return (
    <>
      <AvisoVersionNueva />
      {!usuario ? <Login /> : usuario.rol === 'admin' ? <AdminHome /> : <BarberoHome />}
    </>
  );
}
