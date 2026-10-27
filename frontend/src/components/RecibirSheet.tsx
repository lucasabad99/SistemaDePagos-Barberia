import { useState } from 'react';
import { api, post, Venta } from '../lib/api';
import { fmt, sum } from '../lib/format';
import { useData } from '../lib/useData';
import { useToast } from '../lib/toast';
import { Sheet } from './Sheet';
import { Ticket } from './Ticket';

/** El barbero le entrega al dueño el efectivo de sus papelitos. */
export function RecibirSheet({ barbero, onClose, onDone }: {
  barbero: { id: string; nombre: string };
  onClose: () => void;
  onDone: (total: number) => void;
}) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const { data } = useData(() => api<{ ventas: Venta[] }>(`/ventas?estado=en_barbero&barberoId=${barbero.id}`), [barbero.id]);
  const lista = data?.ventas ?? [];

  async function confirmar() {
    setEnviando(true);
    try {
      const r = await post<{ total: number }>('/ventas/recibir', { barberoId: barbero.id });
      onDone(r.total);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div>
        <h1>Recibir efectivo</h1>
        <p className="sub">{barbero.nombre} te entrega la plata de estos papelitos</p>
      </div>
      <div className="tickets">
        {lista.map((v) => (
          <Ticket key={v.id} v={v} barbero={false} />
        ))}
      </div>
      <div className="card">
        <div className="ledger">
          <span className="tot">Tenés que recibir</span>
          <span className="r tot">{fmt(sum(lista, (v) => v.total))}</span>
        </div>
      </div>
      <button className="big" onClick={confirmar} disabled={!data || !lista.length || enviando}>Contado y recibido</button>
      <button className="btn ghost" onClick={onClose}>Cancelar</button>
    </Sheet>
  );
}
