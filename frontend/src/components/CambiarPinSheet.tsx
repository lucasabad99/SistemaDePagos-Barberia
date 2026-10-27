import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Sheet } from './Sheet';

const soloNumeros = (s: string) => s.replace(/\D/g, '').slice(0, 6);

export function CambiarPinSheet({ onClose }: { onClose: () => void }) {
  const { cambiarPin } = useAuth();
  const toast = useToast();
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (nuevo.length < 4) return setError('El PIN nuevo tiene que tener de 4 a 6 números');
    if (nuevo !== repetir) return setError('Los dos PIN nuevos no coinciden');
    setEnviando(true);
    setError('');
    try {
      await cambiarPin(actual, nuevo);
      toast('PIN cambiado. Se cerró la sesión en tus otros dispositivos.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el PIN');
      setEnviando(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1>Cambiar mi PIN</h1>
          <p className="sub">De 4 a 6 números. Que no sea fácil de adivinar, como 1234 o tu año de nacimiento.</p>
        </div>
        <PinField id="p-act" label="PIN actual" value={actual} onChange={setActual} autoComplete="current-password" />
        <PinField id="p-new" label="PIN nuevo" value={nuevo} onChange={setNuevo} autoComplete="new-password" />
        <PinField id="p-rep" label="Repetí el PIN nuevo" value={repetir} onChange={setRepetir} autoComplete="new-password" />
        {error && <div className="pill bad" style={{ alignSelf: 'flex-start', fontSize: 13 }}>{error}</div>}
        <button className="big" type="submit" disabled={!actual || !nuevo || !repetir || enviando}>
          {enviando ? 'Guardando…' : 'Cambiar PIN'}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </Sheet>
  );
}

export function PinField({ id, label, value, onChange, autoComplete, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(soloNumeros(e.target.value))}
        placeholder="••••"
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
