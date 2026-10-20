import { addDays, dayKey, dayLabel } from '../lib/format';

/** Selector de día: ‹ Hoy › con calendario. No deja ir al futuro. */
export function DayNav({ value, onChange }: { value: string; onChange: (dk: string) => void }) {
  const hoy = dayKey();
  return (
    <div className="monthnav">
      <button className="btn sm" onClick={() => onChange(addDays(value, -1))} aria-label="Día anterior">‹</button>
      <label style={{ position: 'relative', cursor: 'pointer' }}>
        <b style={{ display: 'inline-block' }}>{dayLabel(value)}</b>
        <input
          type="date"
          value={value}
          max={hoy}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Elegir día"
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </label>
      <button className="btn sm" onClick={() => onChange(addDays(value, 1))} disabled={value >= hoy} style={value >= hoy ? { opacity: 0.35 } : undefined} aria-label="Día siguiente">›</button>
    </div>
  );
}
