import { useEffect } from 'react';
import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { AdminHome } from './pages/AdminHome';
import { BarberoHome } from './pages/BarberoHome';
import { AvisoVersionNueva } from './components/Pwa';

export function App() {
  const { usuario, cargando } = useAuth();
  const pantalla = !usuario ? 'login' : usuario.rol === 'admin' ? 'admin' : 'barbero';

  // La clase del body pinta la zona de la hora del iPhone con el color de cada pantalla.
  useEffect(() => {
    document.body.classList.add(pantalla);
    return () => document.body.classList.remove(pantalla);
  }, [pantalla]);

  if (cargando) return null;
  return (
    <>
      <AvisoVersionNueva />
      {pantalla === 'login' ? <Login /> : pantalla === 'admin' ? <AdminHome /> : <BarberoHome />}
    </>
  );
}
