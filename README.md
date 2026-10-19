# El Camino Angosto

Plataforma cristiana de formación y comunidad. Tres experiencias en un solo lugar:

- **Alabanza** — streaming de música (tipo Spotify).
- **Tarjetas de Fe** — feed vertical de video/imagen (tipo TikTok).
- **Discipulado** — cursos por niveles con maestros (tipo Udemy), más chat mentor 1:1.

> *«Entrad por la puerta angosta… porque angosta es la puerta, y angosto el camino que lleva a la vida.»* — Mateo 7:13–14

---

## Arranque rápido

Requisitos: **Node ≥ 22**, **pnpm 9**, un **Postgres** y un **bucket S3-compatible** (en producción, los de Railway).

```bash
pnpm install

# Copia las plantillas de entorno y rellena DATABASE_URL, JWT_SECRET y las S3_*.
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Aplica db/migrations/ sobre tu Postgres.
pnpm db:migrate

pnpm dev
```

- Frontend → http://localhost:5173
- API → http://localhost:3000/api · Swagger en `/api/docs`
- Kit de interfaz → http://localhost:5173/kit-ui

### Cuentas

No hay registro público: las cuentas existentes se importaron de Supabase (sus hashes bcrypt valen tal cual) y el inicio de sesión, la verificación de correo y la recuperación de contraseña los atiende el propio API en `/api/auth/*`.

---|---|---|
| `admin@elcaminoangosto.test` | ADMIN | — |
| `maestro@elcaminoangosto.test` | MAESTRO | — |
| `ester@elcaminoangosto.test` | ESTUDIANTE | 2 (inscrita al curso de ejemplo) |
| `esteban@elcaminoangosto.test` | ESTUDIANTE | 1 |

---

## Estructura

```
apps/
  web/            React + Vite + Tailwind (app + landing)
  api/            NestJS — monolito modular
  worker/         BullMQ + ffmpeg (transcodificación)
packages/
  ui/             design system
  shared-types/   contratos Zod compartidos front↔back
  config/         tailwind preset, eslint, tsconfig
db/               migraciones SQL (`db/migrations/`), las aplica el API al arrancar
docs/             fuente de verdad + landing legacy
```

`apps/api` se divide en **bounded contexts**: `auth`, `users`, `music`, `feed`, `discipleship`, `chat`, `media`, `admin`, `notifications`, `shared`. Cada uno con capas `interface / application / domain / infrastructure`.

**Un módulo nunca importa el interior de otro**: se comunican por servicio público o por evento de dominio. ESLint lo impone (`packages/config/eslint.config.js` → `modularMonolith`).

---

## Comandos

```bash
pnpm dev                     # web + api en desarrollo
pnpm --filter @elcamino/api dev
pnpm lint && pnpm typecheck  # calidad
pnpm test                    # tests unitarios
pnpm build                   # build de producción

pnpm db:migrate              # aplica db/migrations/ sobre DATABASE_URL
pnpm exec codegraph init     # (re)indexa el grafo de código
```

---

## Seguridad

- La sesión es un JWT de acceso (HS256, 15 min) que firma el API más un token de refresco opaco y rotativo, guardado solo como hash. Las contraseñas van con bcrypt.
- **El rol define capacidades; la propiedad y el nivel definen el acceso fino.** `RolesGuard` + `PolicyGuard` en Nest son la autorización primaria; **la base ya no aplica RLS**: cada ruta debe llevar su guard.
- Los campos de gobernanza (`profiles.role`, `posts.status`…) solo los cambia el API, nunca el cliente.
- Los medios privados solo se sirven por **URL firmada** de corta vida, tras validar permiso. Lo público (avatares, miniaturas) lo sirve el API en `/api/files/public/...`.
- Nunca se commitean secretos. Cada app trae su `.env.example`.

**Regla inviolable:** un curso de maestro nunca se autopublica. Pasa por aprobación del admin, y hay tres cerrojos independientes que lo garantizan (máquina de estados, política RLS y privilegio de columna).

---

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/contexto.md`](docs/contexto.md) | Visión, roles, reglas de negocio, máquina de estados. |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Monolito modular, patrones, modelo de datos, seguridad. |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Sistema de diseño: tokens, tipografía, motion. |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Épicas, historias, criterios de aceptación, sprints. |
| [`docs/decisiones.md`](docs/decisiones.md) | ADRs y preguntas abiertas. |
| [`docs/PROGRESO.md`](docs/PROGRESO.md) | Qué está hecho, con su evidencia. |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Reglas para agentes de IA y uso de CodeGraph. |
| [`docs/legacy-landing/`](docs/legacy-landing/) | La landing original, ejecutable. Referencia visual. |
