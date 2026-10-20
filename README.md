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

| Usuario | PIN | Rol |
|---|---|---|
| darwin | 1234 | Dueño (admin) |
| matias | 1111 | Barbero |
| nico | 2222 | Barbero |
| leo | 3333 | Barbero |

## Entornos

| Entorno | Rama | Backend | Frontend | Base |
|---|---|---|---|---|
| Local | cualquiera | `npm run dev` | Vite | MongoDB local |
| Staging | `develop` | Render (servicio web) | Vercel | Atlas, cluster/DB `barberia-staging` |
| Producción | `main` | Render (servicio web) | Vercel | Atlas, DB `barberia-prod` |

Variables por entorno:

- **Backend**: `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` (distinto en cada entorno), `CORS_ORIGIN` (URL del frontend de ese entorno).
- **Frontend**: `VITE_API_URL` (URL pública del backend de ese entorno).

## Roadmap

1. ✅ Base del proyecto + login dueño/barbero
2. Papelitos: anotar corte (barbero) y nueva venta (dueño), vista del día
3. Caja: apertura/cierre, recibir efectivo de barberos, confirmar transferencias
4. Barberos y comisiones, liquidación de fin de mes
5. Inventario, compras y gastos
6. Impuestos (tope de monotributo, resumen para el contador)
7. Clientes y membresías con QR
