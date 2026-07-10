# despliegue.md — Infraestructura de El Camino Angosto

Estado real de la infraestructura provisionada, y por qué está configurada así.

---

## Supabase

| | |
|---|---|
| Organización | `Elcaminoangosto` |
| Proyecto (ref) | `gcxewueeidygglprxigx` |
| Región | `us-east-2` |
| Postgres | 17 |
| Pooler (transacción) | `aws-1-us-east-2.pooler.supabase.com:6543` |

- Las 4 migraciones están aplicadas. Verificado en remoto: **26/26 tablas con RLS**, **64 políticas**, **5 buckets**, y `profiles.role` **no** es actualizable por el rol `authenticated`.
- El proyecto emite **JWT ES256** (asimétrico) en `/auth/v1/.well-known/jwks.json`. El API los verifica contra ese JWKS y **rechaza HS256**.
- `DATABASE_URL` usa el **pooler en puerto 6543** (modo transacción). Por eso `postgres-js` se configura con `prepare: false`: pgbouncer en modo transacción no soporta *prepared statements* con nombre.

> ⚠️ **Staging y producción comparten el mismo proyecto Supabase.** Es aceptable mientras no haya usuarios reales. Antes de abrir la plataforma, crea un segundo proyecto para staging y separa `SUPABASE_PROJECT_REF` por entorno de GitHub.

### Autenticación (ADR-005)

La confirmación de correo está **desactivada** en el MVP (`mailer_autoconfirm: true`) porque no hay SMTP configurado. Se ajusta en el panel de Supabase o por la Management API, **no** con `supabase config push`: `config.toml` tiene `site_url` local y sobrescribiría el de producción. Reactivar antes de abrir la plataforma, junto con un proveedor de correo y HU-1.4 (recuperación de contraseña).

### Seed

`supabase/seed.sql` **solo** se aplica en local (`supabase db reset`). Nunca en remoto.

---

## Railway

| | |
|---|---|
| Proyecto | `elcaminoangosto` |
| ID | `eb9b694f-689a-43f3-8f93-e58d1ad8491d` |
| Entornos | `production`, `staging` |

| Servicio | Producción | Staging |
|---|---|---|
| `api` | https://api-production-f113.up.railway.app | https://api-staging-99c0.up.railway.app |
| `web` | https://web-production-551e4.up.railway.app | https://web-staging-4f40.up.railway.app |
| `worker` | sin dominio; consume la cola | ídem |
| `Redis` | interno, `${{Redis.REDIS_URL}}` | instancia propia |

> ⚠️ **Un entorno nuevo NO hereda los servicios.** `railway environment new staging` crea un
> entorno **vacío**: `railway up` sube el código y recibe un `404 Not Found` porque no hay a qué
> desplegar. Hay que crearlo con `railway environment new staging --duplicate production`, que
> copia servicios, variables y bases de datos.
>
> Al duplicar, las variables llegan **apuntando a producción** (`CORS_ORIGINS`, `VITE_API_URL`).
> Hay que reapuntarlas a los dominios del propio entorno.
>
> Y borrar un entorno **invalida sus project tokens**: hay que regenerarlos.

### Cómo se configura el build (importante)

Railway usa **Railpack**, no Nixpacks, y **solo lee un archivo de configuración en la raíz del repositorio**. En un monorepo con tres servicios eso no sirve: los `railway.json` dentro de `apps/*` **se ignoran por completo** (se comprobó: el build falló con *«No start command detected»* teniéndolos puestos). Se eliminaron para no dar una falsa sensación de configuración.

La configuración vive en **variables de entorno por servicio**:

| Variable | `api` | `worker` | `web` |
|---|---|---|---|
| `RAILPACK_INSTALL_CMD` | `pnpm install --frozen-lockfile --prod=false` | ídem | ídem |
| `RAILPACK_BUILD_CMD` | `pnpm --filter @elcamino/api... build` | `…worker… build` | `…web… build` |
| `RAILPACK_START_CMD` | `pnpm --filter @elcamino/api start` | `…worker start` | — (estático) |
| `RAILPACK_SPA_OUTPUT_DIR` | — | — | `apps/web/dist` |
| `RAILPACK_PACKAGES` | — | `ffmpeg` | — |

Dos trampas que costaron un build cada una:

1. **`--prod=false` en el install es obligatorio.** Con `NODE_ENV=production`, pnpm poda las `devDependencies` y el build se queda sin `nest`, `vite` ni `tsup`.
2. **`railway environment new staging` cambia el entorno enlazado.** Cualquier `railway variables --set` posterior escribe en el entorno equivocado. **Pasa siempre `--environment` explícito.**

### Node 22 es obligatorio

`@supabase/supabase-js` 2.110 requiere **Node 22+**: al construir el cliente inicializa un `RealtimeClient` que exige `WebSocket` nativo, ausente en Node 20. Railpack usaba Node 20 por defecto y el worker moría en el arranque con *«Node.js detected but native WebSocket not found»*.

Fijado en tres sitios para que no dependa de un panel: `engines.node` en el `package.json` raíz, `.nvmrc`, y `RAILPACK_NODE_VERSION=22` en cada servicio.

### El worker es ESM

`apps/worker` declara `"type": "module"`. `tsc` emite `import './config'` **sin extensión**, y Node ESM lo rechaza en tiempo de ejecución (`ERR_MODULE_NOT_FOUND`). No lo detecta ni `tsc` ni `pnpm build`: solo se ve al ejecutar el `dist`. Por eso el worker se empaqueta con **tsup** a un único archivo ESM.

---

## Variables por servicio

Ninguna se commitea. Se definen en Railway y en los secretos de GitHub.

**`api`** — `NODE_ENV`, `LOG_LEVEL`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `REDIS_URL`
**`worker`** — `NODE_ENV`, `LOG_LEVEL`, `MEDIA_CONCURRENCY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`
**`web`** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

Solo las `VITE_*` llegan al navegador. La `service_role` **nunca** sale del servidor.

---

## CI/CD

**`.github/workflows/ci.yml`** (PR y push a `main`/`develop`)

1. `Conventional Commits` — valida el asunto de cada commit del PR.
2. `Lint · Typecheck · Test · Build`.
3. `Migraciones y RLS` — levanta Supabase local, aplica las migraciones y ejecuta las **16 aserciones** de `supabase/tests/rls.test.sql`.

El job 3 no es opcional: **ningún fallo de RLS produce error de compilación**. Sin él, un agujero de autorización pasa el pipeline sin dejar rastro. Ver ADR-004.

**`.github/workflows/deploy.yml`** (push a `main` → producción, a `develop` → staging)

Aplica las migraciones de Supabase **antes** de desplegar (el código nuevo asume el esquema nuevo) y luego lanza los tres servicios.

### Secretos y variables de GitHub

| Nombre | Tipo | Estado |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | secret | ✅ |
| `SUPABASE_DB_PASSWORD` | secret | ✅ |
| `SUPABASE_PROJECT_REF` | variable | ✅ |
| `RAILWAY_TOKEN` (entorno `production`) | secret | ✅ |
| `RAILWAY_TOKEN` (entorno `staging`) | secret | ⬜ **pendiente** |

Los **project tokens de Railway están acotados a un único entorno** y no pueden
crearse por CLI. Hace falta uno por entorno, desde
**Railway → proyecto `elcaminoangosto` → Settings → Tokens**:

```bash
gh secret set RAILWAY_TOKEN --repo Jair-Roman-Mauricio/Elcaminoangosto --env staging --body '<token-staging>'
```

Mientras falte el de `staging`, el job de despliegue **avisa y se salta el paso**
en vez de fallar: las migraciones ya se aplicaron y eso sí es un éxito.

---

## Protección de ramas

`main` y `develop` exigen Pull Request y los tres checks de CI en verde. Sin *force push* ni borrado.

No se exige aprobación de un revisor porque GitHub no permite aprobar el propio PR y hoy hay un único mantenedor: eso dejaría el repositorio bloqueado. Cuando entre una segunda persona, súbelo a `required_approving_review_count: 1` y activa `require_code_owner_reviews`.
