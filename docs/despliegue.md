# despliegue.md — Infraestructura de El Camino Angosto

Estado real de la infraestructura provisionada, y por qué está configurada así.

---

## Base de datos y archivos (Railway)

| | |
|---|---|
| Postgres | servicio `Postgres` de Railway (por entorno) |
| Archivos | Railway Bucket `elcamino-media` (S3-compatible), región `iad` |
| Cuentas | propias, en `users` / `refresh_tokens` / `auth_tokens` |

Se migró desde Supabase en octubre de 2026. El esquema base es `db/migrations/0001_base.sql` (el esquema `public` de Supabase sin RLS ni roles de Supabase) y lo que venga después se añade como `db/migrations/NNNN_*.sql`.

- **Migraciones**: las aplica el API al arrancar (`pnpm --filter @elcamino/api start` ejecuta `dist/migrar.js` y luego `dist/main.js`), con un candado de Postgres para que dos réplicas no choquen. Quedan anotadas en `schema_migrations`.
- **Archivos**: un solo bucket físico aloja los cinco lógicos como prefijos (`music/…`, `feed-media/…`, `thumbnails/…`). Los privados se leen con URL prefirmada (60 min). Los públicos (`avatars`, `thumbnails`) los sirve el API en `/api/files/public/<bucket>/<ruta>`, con `?w=` y `?q=` para redimensionar a WebP. Railway Buckets no admiten CORS desde el navegador, por eso **las subidas pasan por el API** (`PUT /api/media/uploads/:id/content` y `PUT /api/media/images`).
- **Sesión**: JWT de acceso HS256 de 15 min firmado con `JWT_SECRET` + token de refresco opaco rotativo (30 días), guardado solo como SHA-256. Contraseñas con bcrypt (los hashes importados de Supabase valen tal cual y se renuevan al primer login).
- **Correo** (verificación y recuperación): SMTP por variables `SMTP_*` (Brevo). Sin SMTP el enlace sale en el log del API.
- **Conectarse desde la Mac**: el Postgres de Railway solo es accesible por su red privada. Para trabajar desde fuera hay que crear un proxy TCP temporal (`railway tcp-proxy create --port 5432 -s Postgres -e <entorno>`) y **borrarlo al terminar**.

> ⚠️ Al migrar, las URLs públicas guardadas en la base (`albums.cover_image_url`, `songs.background_url`, y las que haya dentro de Markdown) apuntaban a `…supabase.co/storage/v1/object/public/…` y se reescribieron a `<API_PUBLIC_URL>/files/public/…`. Un entorno nuevo debe repetir esa reescritura con su propio `API_PUBLIC_URL`.

### Autenticación

No hay registro público. La verificación de correo y la recuperación de contraseña las atiende `/api/auth/*`; los enlaces apuntan a `APP_URL` (`/verificar-correo?token=…`, `/restablecer-contrasena?token=…`).

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
| `web` | https://elcaminoangosto.up.railway.app | https://web-staging-4f40.up.railway.app |
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

### Node 22

El proyecto corre en Node 22. Fijado en tres sitios para que no dependa de un panel: `engines.node` en el `package.json` raíz, `.nvmrc`, y `RAILPACK_NODE_VERSION=22` en cada servicio.

### El worker es ESM

`apps/worker` declara `"type": "module"`. `tsc` emite `import './config'` **sin extensión**, y Node ESM lo rechaza en tiempo de ejecución (`ERR_MODULE_NOT_FOUND`). No lo detecta ni `tsc` ni `pnpm build`: solo se ve al ejecutar el `dist`. Por eso el worker se empaqueta con **tsup** a un único archivo ESM.

---

## Variables por servicio

Ninguna se commitea. Se definen en Railway y en los secretos de GitHub.

**`api`** — `NODE_ENV`, `LOG_LEVEL`, `CORS_ORIGINS`, `APP_URL`, `API_PUBLIC_URL`, `JWT_SECRET`, `DATABASE_URL` (`${{Postgres.DATABASE_URL}}`), `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `REDIS_URL`, y opcionalmente `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
**`worker`** — `NODE_ENV`, `LOG_LEVEL`, `MEDIA_CONCURRENCY`, `DATABASE_URL`, `S3_*`, `REDIS_URL`
**`web`** — `VITE_API_URL`

Solo las `VITE_*` llegan al navegador.

---

## CI/CD

**`.github/workflows/ci.yml`** (PR y push a `main`/`develop`)

1. `Conventional Commits` — valida el asunto de cada commit del PR.
2. `Lint · Typecheck · Test · Build`.
3. `Migraciones` — levanta un Postgres vacío, aplica `db/migrations/` dos veces y comprueba que la segunda no hace nada.

**`.github/workflows/deploy.yml`** (push a `main` → producción, a `develop` → staging)

Lanza los tres servicios en Railway. Las migraciones las aplica el API al arrancar, antes de aceptar tráfico.

### Secretos y variables de GitHub

| Nombre | Tipo | Estado |
|---|---|---|
| `RAILWAY_TOKEN` (entorno `production`) | secret | ✅ |
| `RAILWAY_TOKEN` (entorno `staging`) | secret | ⬜ **pendiente** |

Los **project tokens de Railway están acotados a un único entorno** y no pueden
crearse por CLI. Hace falta uno por entorno, desde
**Railway → proyecto `elcaminoangosto` → Settings → Tokens**:

```bash
gh secret set RAILWAY_TOKEN --repo Jair-Roman-Mauricio/Elcaminoangosto --env staging --body '<token-staging>'
```

Mientras falte el de `staging`, el job de despliegue **avisa y se salta el paso**
en vez de fallar.

### Correo transaccional con Brevo

1. En Brevo, verifica el remitente y autentica su dominio con los registros DNS de DKIM y DMARC.
2. En **Transactional → Settings → SMTP & API**, copia el *SMTP login* y crea una **SMTP key** (no es la contraseña de la cuenta ni una API key).
3. Ponlas como variables del servicio `api` en Railway, una vez por entorno:

```bash
railway variable set SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 \
  SMTP_USER='<smtp-login-de-brevo>' SMTP_PASS='<smtp-key-de-brevo>' \
  MAIL_FROM='El Camino Angosto <no-reply@tu-dominio.com>' -s api -e staging
```

Sin `SMTP_HOST` el API no envía nada: escribe el correo (con su enlace) en el log. Nunca se escriben estas credenciales en un `.env` versionado.

---

## Protección de ramas

`main` y `develop` exigen Pull Request y CI en verde, sin *force push* ni borrado. Los checks
obligatorios **no son los mismos en las dos ramas**:

| Rama | Checks obligatorios |
|---|---|
| `develop` | `Conventional Commits` · `Lint · Typecheck · Test · Build` · `Migraciones y RLS` |
| `main` | `Lint · Typecheck · Test · Build` · `Migraciones y RLS` |

`Conventional Commits` **no se exige en `main` a propósito**: el job se salta los PR hacia `main`
(`ci.yml`, `if: github.base_ref == 'develop'`) porque un release agrupa commits ya validados y
merge commits que no siguen el formato. Mientras estuvo en la lista de obligatorios, GitHub lo
contaba como pendiente y **ningún PR de release podía fusionarse**: el check exigido no podía
ocurrir nunca. Cada commit de trabajo sigue validándose al entrar a `develop`, que es donde el
job sí corre.

No se exige aprobación de un revisor porque GitHub no permite aprobar el propio PR y hoy hay un único mantenedor: eso dejaría el repositorio bloqueado. Cuando entre una segunda persona, súbelo a `required_approving_review_count: 1` y activa `require_code_owner_reviews`.
