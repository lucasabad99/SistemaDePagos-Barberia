import { ReactNode } from 'react';
import { I } from './Icons';

export function Kpi({ l, v, ic, cls, d }: { l: string; v: string; ic: keyof typeof I; cls: string; d?: string }) {
  return (
    <div className="card kpi">
      <div className="row">
        <span className="l">{l}</span>
        <span className="card-h"><span className={'ic ' + cls}>{I[ic]}</span></span>
      </div>
      <div className="v">{v}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

export function CardH({ t, ic, cls, right }: { t: string; ic: keyof typeof I; cls: string; right?: ReactNode }) {
  return (
    <div className="card-h">
      <div className="t">
        <span className={'ic ' + cls}>{I[ic]}</span>
        <h2>{t}</h2>
      </div>
      {right}
    </div>
  );
}
