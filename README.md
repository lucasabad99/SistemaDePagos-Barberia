# Papelito Barbería — Sistema de pagos

Reemplaza los papelitos de cada corte por un registro digital. El dueño ve todo (caja, ventas, comisiones, inventario, impuestos) y cada barbero ve solo lo suyo.

El prototipo original está en [docs/prototipo/papelito.html](docs/prototipo/papelito.html) (se abre directo en el navegador).

## Stack

| Parte | Tecnología |
|---|---|
| Backend | Node.js + Express + TypeScript + Mongoose |
| Base de datos | MongoDB (local en desarrollo, Atlas en staging/producción) |
| Auth | Usuario + PIN (hasheado con bcrypt), JWT, rate limit en el login |
| Frontend | React + Vite + TypeScript |

```
backend/    API REST (puerto 4000)
frontend/   App web (puerto 5173)
docs/       Prototipo y documentación
```

## Correr en local

Requisitos: Node 20+ y MongoDB (instalado como servicio, o con Docker: `npm run db:up`).

```bash
npm run install:all                 # instala dependencias de raíz, backend y frontend
cp backend/.env.example backend/.env   # y poner un JWT_SECRET largo
npm run seed                        # crea usuarios de ejemplo
npm run dev                         # levanta API + web
```

Abrir http://localhost:5173

| Usuario | PIN | Rol | Local |
|---|---|---|---|
| darwin | 1234 | Dueño (admin) | elige al entrar |
| matias | 1111 | Barbero | Almagro |
| nico | 2222 | Barbero | Almagro |
| leo | 3333 | Barbero | Acuña |

### Locales

La barbería tiene dos locales (**Acuña** y **Almagro**), con los números separados:

- El dueño elige el local al iniciar sesión y lo puede cambiar desde el menú. Hoy, Pagos, Resumen y Barberos muestran solo ese local. El local elegido viaja en cada pedido en el encabezado `X-Local`.
- Cada barbero pertenece a un local: sus papelitos quedan ahí solos. El dueño lo puede pasar al otro local desde *Editar*.
- Los precios son los mismos en los dos locales; el stock de productos es de cada local.
- Al arrancar, el servidor crea los locales si no existen y le asigna local a los datos anteriores (`backend/src/seed/locales.ts`).

### Inventario

Sección *Inventario* del dueño (API en `/api/productos`, solo admin), siempre del local elegido:

- **Alta, edición y baja** de productos. El producto, su nombre y su precio son de los dos locales; el stock inicial que se carga es del local actual (el otro arranca en 0). Dar de baja lo saca de "Anotar corte" sin borrar el historial.
- **Entró mercadería** (suma; si trae costo, actualiza el costo del producto) y **Corregir** (se cuenta lo que hay y se anota la diferencia).
- Cada venta descuenta sola y anular un papelito devuelve el stock. Todo queda en el **historial** del producto por local (colección `movimientos_stock`).
- Avisa *Reponer* cuando el stock llega al mínimo, y muestra el stock del otro local y lo vendido en el mes.

### Mercado Pago (transferencias que se confirman solas)

Opcional. Con la variable `MP_ACCESS_TOKEN` (Access Token de **producción** de la cuenta donde llegan las transferencias, `APP_USR-...`), el servidor **lee** lo recibido en esa cuenta y confirma solos los papelitos por transferencia. Es solo lectura: no cobra ni usa el checkout, así que no hay comisión ([backend/src/services/mercadopago.ts](backend/src/services/mercadopago.ts)).

- Se consulta `GET /v1/payments/search` al mirar los papelitos (como mucho cada 30 s) y cada minuto mientras el servidor está despierto. Solo si hay transferencias pendientes.
- Cuentan las recibidas y aprobadas: desde bancos al CVU/alias, desde otra cuenta de Mercado Pago y DEBIN.
- Un papelito se confirma solo cuando hay **una única** transferencia del **mismo monto** (con recargo) entre 1 h antes y 3 h después, y esa transferencia no puede ser de otro papelito. Si hay dudas (dos iguales, otro monto), el dueño ve las transferencias candidatas en el papelito y elige con "Es esta". Siempre queda "Ya la vi en el banco" para confirmar a mano.
- Cada transferencia se usa para un solo papelito; anular el papelito la libera.
- El token se carga en Render (*Environment*), nunca en el repo. Para probar qué devuelve la API con una cuenta: `$env:MP_ACCESS_TOKEN="APP_USR-..."; npm --prefix backend run mp:probar` (solo lectura).

## Instalar en el celular (PWA)

La app se instala desde el navegador, sin tiendas. Abrir la URL del entorno y:

- **Android (Chrome):** tocar "Instalar Papelito en este celular" en el login, o menú ⋮ → "Instalar app".
- **iPhone (Safari):** Compartir → "Agregar a inicio".

Queda con ícono propio y abre a pantalla completa. Cada deploy llega solo al volver a abrir la app; si estaba abierta, aparece "Hay una versión nueva · Actualizar". El service worker ([frontend/public/sw.js](frontend/public/sw.js)) pide siempre la red primero y nunca guarda respuestas de la API.

## Entornos

| Entorno | Rama | Dónde corre | Base |
|---|---|---|---|
| Local | cualquiera | `npm run dev` (API en :4000, Vite en :5173) | MongoDB local, DB `barberia` |
| Staging | `develop` | Render, servicio `barberia-staging` | Atlas, DB `barberia-staging` |
| Producción | `main` | Render (a definir) | Atlas, DB `barberia-prod` |

En staging y producción **un solo servicio** sirve la API (`/api/...`) y la web compilada (`frontend/dist`), así que no hace falta CORS ni `VITE_API_URL`. La configuración está en [render.yaml](render.yaml).

Flujo de ramas: `feature/*` → PR a `develop` (se publica solo en staging) → PR a `main` (producción).

### Variables del servidor

| Variable | Local | Staging / Producción |
|---|---|---|
| `NODE_ENV` | `development` | `staging` / `production` |
| `MONGODB_URI` | `mongodb://localhost:27017/barberia` | La de Atlas (se carga a mano en Render) |
| `JWT_SECRET` | en `backend/.env` | La genera Render (distinta por entorno) |

### Cargar datos de ejemplo en staging

El plan gratis de Render no tiene consola, así que el seed se corre desde tu máquina apuntando a Atlas:

```bash
# PowerShell
$env:NODE_ENV="staging"; $env:MONGODB_URI="mongodb+srv://...barberia-staging..."; npm run seed
# Bash
NODE_ENV=staging MONGODB_URI="mongodb+srv://...barberia-staging..." npm run seed
```

El seed se niega a correr con `NODE_ENV=production`.

### Limitaciones del plan gratis de Render

- El servicio se duerme tras 15 min sin uso; la primera visita después tarda ~1 minuto en despertar.
- Para producción conviene el plan pago (~USD 7/mes) para que esté siempre despierto.

## Roadmap

1. ✅ Base del proyecto + login dueño/barbero
2. ✅ Papelitos: anotar corte (barbero) y nueva venta (dueño), vista por día, recibir efectivo de barberos, confirmar transferencias, anular
3. ✅ Barberos: alta, edición, comisión, activar/desactivar, PIN (el dueño lo resetea; cada uno cambia el suyo). Desactivar o cambiar el PIN cierra la sesión al instante
4. ✅ Pagos semanales (lunes a domingo): "A pagar esta semana" en la pantalla principal, sección Pagos para registrar cada pago (bloqueado si el barbero tiene efectivo sin entregar), Resumen con los números del negocio, calendario para el dueño y "Mis cobros" con calendario para el barbero
5. ✅ Dos locales (Acuña y Almagro): el dueño elige en cuál trabaja, cada barbero pertenece a uno, stock por local
6. ✅ Inventario: ABM de productos, entradas de mercadería, correcciones e historial de movimientos por local
7. Caja: apertura/cierre y arqueo
8. Compras a proveedores y gastos
9. Impuestos (tope de monotributo, resumen para el contador)
10. Clientes y membresías con QR
