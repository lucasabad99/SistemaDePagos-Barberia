import { useEffect, useState } from 'react';

/** Registra el service worker (solo en la app publicada, no en desarrollo). */
export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin service worker la app funciona igual, solo no es instalable */
    });
  });
}

const BUNDLE = /\/assets\/index-[\w-]+\.js/;

/**
 * Detecta si se publicó una versión nueva mientras la app estaba abierta
 * (en el celu una PWA puede quedar abierta días en segundo plano sin recargarse).
 * Compara el archivo principal que trae el servidor con el que está corriendo.
 */
export function useVersionNueva() {
  const [hay, setHay] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const actual = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src.match(BUNDLE)?.[0];
    if (!actual) return;

    const revisar = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text();
        const publicado = html.match(BUNDLE)?.[0];
        if (publicado && publicado !== actual) setHay(true);
      } catch {
        /* sin conexión: se revisa la próxima vez */
      }
    };

    document.addEventListener('visibilitychange', revisar);
    const id = setInterval(revisar, 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', revisar);
      clearInterval(id);
    };
  }, []);

  return hay;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const yaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Ofrecer instalar la app:
 *  - Android/Chrome: el navegador avisa que se puede instalar y mostramos un botón.
 *  - iPhone: Safari no tiene botón automático; mostramos cómo hacerlo a mano.
 */
export function useInstalarApp() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(yaInstalada);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    const onInstalada = () => {
      setInstalada(true);
      setEvento(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalada);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalada);
    };
  }, []);

  return {
    instalada,
    puedeInstalar: !instalada && !!evento,
    mostrarGuiaIphone: !instalada && !evento && esIphone(),
    instalar: async () => {
      if (!evento) return;
      await evento.prompt();
      await evento.userChoice;
      setEvento(null);
    },
  };
}
