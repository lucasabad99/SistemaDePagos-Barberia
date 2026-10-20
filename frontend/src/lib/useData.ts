import { useCallback, useEffect, useState } from 'react';

/** Carga datos async y permite recargarlos. Opcionalmente refresca cada `pollMs`. */
export function useData<T>(fn: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let vivo = true;
    fn()
      .then((d) => {
        if (vivo) {
          setData(d);
          setError('');
        }
      })
      .catch((e: Error) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, reload]);

  return { data, error, reload };
}
