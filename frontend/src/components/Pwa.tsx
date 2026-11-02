import { useState } from 'react';
import { useInstalarApp, useVersionNueva } from '../lib/pwa';

/** Cartel arriba cuando hay una versión nueva publicada. */
export function AvisoVersionNueva() {
  const hay = useVersionNueva();
  if (!hay) return null;
  return (
    <div className="upd" role="status">
      <span>Hay una versión nueva</span>
      <button onClick={() => window.location.reload()}>Actualizar</button>
    </div>
  );
}

/** En el login: botón "Instalar app" (Android) o guía para agregarla a inicio (iPhone). */
export function InstalarApp() {
  const { puedeInstalar, mostrarGuiaIphone, instalar } = useInstalarApp();
  const [verGuia, setVerGuia] = useState(false);

  if (puedeInstalar)
    return (
      <button type="button" className="linkbtn" onClick={instalar}>
        Instalar Papelito en este celular
      </button>
    );

  if (mostrarGuiaIphone)
    return verGuia ? (
      <div className="guia-ios">
        <b>Instalar en iPhone</b>
        <ol>
          <li>Abrí esta página en <b>Safari</b>.</li>
          <li>Tocá <b>Compartir</b> (el cuadrado con la flecha, abajo).</li>
          <li>Elegí <b>“Agregar a inicio”</b> y después <b>Agregar</b>.</li>
        </ol>
      </div>
    ) : (
      <button type="button" className="linkbtn" onClick={() => setVerGuia(true)}>
        ¿Cómo instalo Papelito en el iPhone?
      </button>
    );

  return null;
}
