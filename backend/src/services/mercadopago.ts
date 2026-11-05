// Conexión de SOLO LECTURA con la cuenta de Mercado Pago del dueño.
// Trae lo recibido (transferencias desde bancos, desde Mercado Pago y DEBIN) y confirma solos
// los papelitos por transferencia cuando hay una coincidencia segura de monto y horario.
// No cobra nada ni usa el checkout de Mercado Pago: no hay comisión.
import { Types } from 'mongoose';
import { env } from '../config/env';
import { CobroMP } from '../models/CobroMP';
import { Venta } from '../models/Venta';

/** Cuánto antes o después del papelito puede llegar la transferencia para considerarla suya. */
export const VENTANA = { antesMin: 60, despuesMin: 180 };
const CADA_MS = env.MP_CADA_MS; // como mucho una consulta a Mercado Pago cada 30 s (por defecto)
const MAX_DIAS = 7;

export const mpActivo = () => Boolean(env.MP_ACCESS_TOKEN);

const estado = { ultima: 0, ultimaOk: null as Date | null, error: null as string | null, cuenta: null as string | null, collectorId: null as string | null };
let enCurso: Promise<void> | null = null;

export const estadoMP = () => ({ activo: mpActivo(), cuenta: estado.cuenta, ultimaSync: estado.ultimaOk, error: estado.error });

async function get<T>(path: string): Promise<T> {
  const r = await fetch(env.MP_API_URL + path, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(10_000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'El token de Mercado Pago no es válido o venció' : `Mercado Pago respondió ${r.status}`);
  return data as T;
}

interface PagoMP {
  id: number | string;
  date_created: string;
  date_approved?: string | null;
  status: string;
  collector_id?: number | string;
  transaction_amount: number;
  payment_method_id?: string;
  payer?: { first_name?: string | null; last_name?: string | null } | null;
}

const medioDe = (m?: string) => (m === 'cvu' ? 'banco' : m === 'debin_transfer' ? 'debin' : m === 'account_money' ? 'mercadopago' : 'otro');
const pagadorDe = (p: PagoMP['payer']) => {
  const n = p?.first_name?.trim();
  const a = p?.last_name?.trim();
  return n ? (a ? `${n} ${a[0]}.` : n) : null;
};

/** Trae de Mercado Pago lo recibido desde el papelito pendiente más viejo y lo guarda. */
async function traerCobros() {
  if (!estado.collectorId) {
    const yo = await get<{ id: number; nickname: string }>('/users/me');
    estado.collectorId = String(yo.id);
    estado.cuenta = yo.nickname;
  }
  const masVieja = await Venta.findOne({ metodo: 'transferencia', estado: 'pendiente', fecha: { $gte: new Date(Date.now() - MAX_DIAS * 864e5) } })
    .sort({ fecha: 1 })
    .select('fecha');
  if (!masVieja) return; // nada para confirmar: no hace falta consultar
  const dias = Math.min(MAX_DIAS, Math.ceil((Date.now() - +masVieja.fecha) / 864e5 + VENTANA.antesMin / 1440) || 1);

  for (let offset = 0; offset < 1000; offset += 100) {
    const q = new URLSearchParams({ sort: 'date_created', criteria: 'desc', range: 'date_created', begin_date: `NOW-${dias}DAYS`, end_date: 'NOW', limit: '100', offset: String(offset) });
    const r = await get<{ results: PagoMP[] }>(`/v1/payments/search?${q}`);
    const recibidos = r.results.filter((p) => p.status === 'approved' && String(p.collector_id) === estado.collectorId);
    if (recibidos.length) {
      await CobroMP.bulkWrite(
        recibidos.map((p) => ({
          updateOne: {
            filter: { mpId: String(p.id) },
            update: {
              $setOnInsert: {
                mpId: String(p.id),
                fecha: new Date(p.date_approved ?? p.date_created),
                monto: p.transaction_amount,
                pagador: pagadorDe(p.payer),
                medio: medioDe(p.payment_method_id),
              },
            },
            upsert: true,
          },
        })),
      );
    }
    if (r.results.length < 100) break;
  }
}

const enVentana = (venta: Date, cobro: Date) =>
  +cobro >= +venta - VENTANA.antesMin * 60e3 && +cobro <= +venta + VENTANA.despuesMin * 60e3;

/**
 * Confirma los papelitos que tienen una única transferencia posible (mismo monto, dentro de la ventana)
 * cuando esa transferencia, a su vez, solo puede ser de ese papelito. Si hay dudas, no adivina.
 */
export async function conciliar() {
  const desde = new Date(Date.now() - MAX_DIAS * 864e5);
  const ventas = await Venta.find({ metodo: 'transferencia', estado: 'pendiente', fecha: { $gte: desde } }).select('fecha total');
  if (!ventas.length) return 0;
  const cobros = await CobroMP.find({ venta: null, fecha: { $gte: new Date(+desde - VENTANA.antesMin * 60e3) } }).select('fecha monto');

  let confirmadas = 0;
  let libresV = ventas;
  let libresC = cobros;
  for (let seguir = true; seguir; ) {
    seguir = false;
    for (const v of libresV) {
      const candidatos = libresC.filter((c) => c.monto === v.total && enVentana(v.fecha, c.fecha));
      if (candidatos.length !== 1) continue;
      const c = candidatos[0];
      const rivales = libresV.filter((o) => o.total === c.monto && enVentana(o.fecha, c.fecha));
      if (rivales.length !== 1) continue;
      if (await asignar(v._id, c._id)) confirmadas++;
      libresV = libresV.filter((o) => !o._id.equals(v._id));
      libresC = libresC.filter((o) => !o._id.equals(c._id));
      seguir = true; // al sacar este par, puede que otros queden sin dudas
      break;
    }
  }
  return confirmadas;
}

/** Une un cobro con un papelito pendiente y lo confirma. Devuelve false si alguno ya estaba usado. */
export async function asignar(ventaId: Types.ObjectId | string, cobroId: Types.ObjectId | string, por: 'mercadopago' | 'dueño' = 'mercadopago') {
  const ahora = new Date();
  const c = await CobroMP.findOneAndUpdate({ _id: cobroId, venta: null }, { $set: { venta: ventaId, asignadoEn: ahora } });
  if (!c) return false;
  const v = await Venta.updateOne(
    { _id: ventaId, metodo: 'transferencia', estado: 'pendiente' },
    { $set: { estado: 'verificado', verificadoEn: ahora, verificadoPor: por, cobroMP: c._id } },
  );
  if (!v.modifiedCount) {
    await CobroMP.updateOne({ _id: c._id }, { $set: { venta: null, asignadoEn: null } }); // el papelito ya no estaba pendiente
    return false;
  }
  return true;
}

/** Libera el cobro de un papelito anulado, para que pueda usarse en otro. */
export const liberarCobro = (cobroId: Types.ObjectId | null | undefined) =>
  cobroId ? CobroMP.updateOne({ _id: cobroId }, { $set: { venta: null, asignadoEn: null } }) : Promise.resolve();

/**
 * Sincroniza con Mercado Pago si pasó un rato desde la última vez. Se llama al mirar los papelitos,
 * así funciona aunque el servidor se haya dormido. Espera como mucho `maxEsperaMs` para no trabar la pantalla.
 */
export async function sincronizarMP(maxEsperaMs = 4000) {
  if (!mpActivo()) return;
  if (!enCurso && Date.now() - estado.ultima >= CADA_MS) {
    estado.ultima = Date.now();
    enCurso = (async () => {
      try {
        await traerCobros();
        const n = await conciliar();
        estado.ultimaOk = new Date();
        estado.error = null;
        if (n) console.log(`Mercado Pago: ${n} transferencia${n > 1 ? 's' : ''} confirmada${n > 1 ? 's' : ''} sola${n > 1 ? 's' : ''}`);
      } catch (err) {
        estado.error = err instanceof Error ? err.message : String(err);
        console.error('Mercado Pago:', estado.error);
      } finally {
        enCurso = null;
      }
    })();
  }
  if (enCurso) await Promise.race([enCurso, new Promise((r) => setTimeout(r, maxEsperaMs))]);
}

/** Cobros sin usar que podrían ser de este papelito: primero los del mismo monto, después los del mismo rato. */
export async function candidatos(venta: { fecha: Date; total: number }) {
  const cobros = await CobroMP.find({
    venta: null,
    fecha: { $gte: new Date(+venta.fecha - VENTANA.antesMin * 60e3), $lte: new Date(+venta.fecha + VENTANA.despuesMin * 60e3) },
  })
    .sort({ fecha: 1 })
    .limit(30);
  return cobros
    .map((c) => ({ ...(c.toJSON() as Record<string, unknown>), mismoMonto: c.monto === venta.total }))
    .sort((a, b) => Number(b.mismoMonto) - Number(a.mismoMonto));
}
