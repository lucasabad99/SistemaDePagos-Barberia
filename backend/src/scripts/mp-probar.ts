// Prueba de SOLO LECTURA de la API de Mercado Pago: ¿aparecen las transferencias que entran al alias?
// No mueve plata ni cambia nada en la cuenta. El token se pasa por variable de entorno, nunca en el código:
//   PowerShell:  $env:MP_ACCESS_TOKEN="APP_USR-..."; npm run mp:probar
//   Opcional:    $env:MP_DIAS="3"   (cuántos días hacia atrás mirar, por defecto 7)
const token = process.env.MP_ACCESS_TOKEN;
if (!token) {
  console.error('Falta MP_ACCESS_TOKEN (el Access Token de producción de tu aplicación de Mercado Pago).');
  process.exit(1);
}
const dias = Number(process.env.MP_DIAS ?? 7);
const API = 'https://api.mercadopago.com';

async function get(path: string) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, any> };
}

// Para no mostrar datos de los clientes completos en pantalla.
const tapar = (s?: string | null) => (s ? s.slice(0, 2) + '***' : '—');

async function main() {
const yo = await get('/users/me');
if (yo.status !== 200) {
  console.error(`El token no anda (HTTP ${yo.status}): ${yo.data.message ?? ''}`);
  process.exit(1);
}
console.log(`Cuenta: ${yo.data.nickname} (id ${yo.data.id}, ${yo.data.site_id})\n`);

// 1) Pagos / transferencias recibidas (lo que la cuenta "cobró").
const q = new URLSearchParams({
  sort: 'date_created',
  criteria: 'desc',
  range: 'date_created',
  begin_date: `NOW-${dias}DAYS`,
  end_date: 'NOW',
  limit: '50',
});
const pagos = await get(`/v1/payments/search?${q}`);
console.log(`== /v1/payments/search (últimos ${dias} días): HTTP ${pagos.status}, ${pagos.data.paging?.total ?? 0} resultados`);
for (const p of pagos.data.results ?? []) {
  const recibido = String(p.collector_id) === String(yo.data.id);
  console.log(
    [
      new Date(p.date_created).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
      `$${p.transaction_amount}`,
      recibido ? 'RECIBIDO' : 'enviado/otro',
      `estado=${p.status}`,
      `operacion=${p.operation_type}`,
      `tipo=${p.payment_type_id}`,
      `medio=${p.payment_method_id}`,
      `acreditado=${p.money_release_date ? 'sí' : '—'}`,
      `de=${tapar(p.payer?.first_name ?? p.payer?.email)}`,
      p.description ? `"${String(p.description).slice(0, 30)}"` : '',
    ].join(' | '),
  );
}

// 2) Otra fuente posible: los movimientos de la cuenta (puede no estar habilitada para todas las cuentas).
const mov = await get(`/mercadopago_account/movements/search?limit=20&sort=date_created&criteria=desc`);
console.log(`\n== /mercadopago_account/movements/search: HTTP ${mov.status}${mov.status !== 200 ? ' — ' + (mov.data.message ?? '') : ''}`);
for (const m of mov.data.results ?? []) {
  console.log([m.date_created, `$${m.amount}`, `tipo=${m.type}`, `detalle=${m.detail}`, `estado=${m.status}`].join(' | '));
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
