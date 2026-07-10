# El Camino Angosto

Plataforma cristiana de formación y comunidad. Tres experiencias en un solo lugar:

- **Alabanza** — streaming de música (tipo Spotify).
- **Tarjetas de Fe** — feed vertical de video/imagen (tipo TikTok).
- **Discipulado** — cursos por niveles con maestros (tipo Udemy), más chat mentor 1:1.

> *«Entrad por la puerta angosta… porque angosta es la puerta, y angosto el camino que lleva a la vida.»* — Mateo 7:13–14

---

## Arranque rápido

Requisitos: **Node ≥ 20**, **pnpm 9**, **Docker** (para Supabase local).

```bash
pnpm install

# Levanta Postgres, Auth, Storage y Realtime en local,
# aplica las migraciones y carga el seed.
supabase start
supabase db reset

# Copia las plantillas de entorno y rellena las claves que imprime `supabase start`.
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm dev
```

- Frontend → http://localhost:5173
- API → http://localhost:3000/api · Swagger en `/api/docs`
- Supabase Studio → http://localhost:54323
- Kit de interfaz → http://localhost:5173/kit-ui

### Usuarios del seed

Contraseña de todos: `camino123`

| Correo | Rol | Nivel |
|---|---|---|
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
supabase/         migraciones SQL, políticas RLS, seed, tests
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

supabase db reset            # recrea la BD, migra y siembra
pnpm exec codegraph init     # (re)indexa el grafo de código
```

### Tests de seguridad de la base de datos

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls.test.sql
```

16 aserciones sobre RLS y privilegios. **Corren en CI.** Ningún fallo de RLS produce error de compilación: este es el único sitio donde se ven.

---

## Seguridad

- El front usa `@supabase/supabase-js`; el API verifica el JWT contra el **JWKS asimétrico** (ES256/RS256) con `jose`. El secreto **HS256 legacy se rechaza** deliberadamente.
- **El rol define capacidades; la propiedad y el nivel definen el acceso fino.** `RolesGuard` + `PolicyGuard` en Nest son la autorización primaria; **RLS es defensa en profundidad**.
- RLS filtra *filas*, no *columnas*: los campos de gobernanza (`profiles.role`, `profiles.current_level_id`, `posts.status`, `courses.published_at`) están protegidos además con **privilegios de columna**. Ver `docs/decisiones.md` → ADR-004.
- Los medios privados solo se sirven por **URL firmada** de corta vida, tras validar permiso/nivel/inscripción.
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
