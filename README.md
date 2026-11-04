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
5. Caja: apertura/cierre y arqueo
6. Inventario, compras y gastos
7. Impuestos (tope de monotributo, resumen para el contador)
8. Clientes y membresías con QR
