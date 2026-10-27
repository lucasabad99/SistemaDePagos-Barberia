import { addDays, weekDates, weekLabel, weekStart } from '../lib/format';

/** Selector de semana (lunes a domingo): ‹ Esta semana › */
export function WeekNav({ value, onChange }: { value: string; onChange: (lunes: string) => void }) {
  const actual = weekStart();
  const enActual = value >= actual;
  const label = weekLabel(value);
  return (
    <div className="monthnav">
      <button className="btn sm" onClick={() => onChange(addDays(value, -7))} aria-label="Semana anterior">‹</button>
      <div style={{ textAlign: 'center', minWidth: 130 }}>
        <b style={{ display: 'block', minWidth: 0, textTransform: 'none' }}>{label}</b>
        {label !== weekDates(value) && <span className="small">{weekDates(value)}</span>}
      </div>
      <button className="btn sm" onClick={() => onChange(addDays(value, 7))} disabled={enActual} style={enActual ? { opacity: 0.35 } : undefined} aria-label="Semana siguiente">›</button>
    </div>
  );
}
