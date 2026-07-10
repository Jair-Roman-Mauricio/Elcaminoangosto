# Cómo contribuir

## Modelo de ramas

```
main ──────────●───────────●──────────►  producción (desplegado automáticamente)
                ▲           ▲
develop ──●──●──┴──●──●──●──┘            staging (desplegado automáticamente)
           ▲     ▲     ▲
           │     │     └── feat/hu-4-1-catalogo-por-nivel
           │     └──────── fix/token-expirado
           └────────────── chore/gobernanza-repo
```

- **`main`** — producción. Solo recibe merges desde `develop`. Protegida.
- **`develop`** — integración continua, desplegada a *staging*. Protegida.
- **Ramas de trabajo** — salen de `develop` y vuelven por Pull Request.

**Nunca se empuja directo a `main` ni a `develop`.**

### Nombres de rama

| Prefijo | Cuándo | Ejemplo |
|---|---|---|
| `feat/` | historia nueva del backlog | `feat/hu-4-1-catalogo-por-nivel` |
| `fix/` | corrección de un defecto | `fix/url-firmada-caducada` |
| `refactor/` | cambio interno sin cambio de comportamiento | `refactor/extraer-policy-registry` |
| `docs/` | solo documentación | `docs/adr-005-outbox` |
| `chore/` | tooling, CI, dependencias | `chore/gobernanza-repo` |
| `test/` | solo tests | `test/rls-moderacion` |

Cuando la rama implementa una historia, **incluye su identificador** (`hu-4-1`).

## Commits — Conventional Commits

```
<tipo>(<ámbito opcional>): <resumen en imperativo, minúscula, sin punto final>

<cuerpo opcional: el PORQUÉ, no el qué>

<pie opcional: BREAKING CHANGE, Refs, Co-Authored-By>
```

Tipos permitidos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`, `style`, `revert`.

Ámbitos habituales: `api`, `web`, `worker`, `ui`, `db`, `types`, `config`, `deps`.

```bash
# Bien
feat(discipleship): filtrar el catálogo por el nivel del estudiante
fix(auth): rechazar tokens sin claim `sub`
docs: registrar ADR-005 sobre el patrón outbox

# Mal
Update files          # no dice nada, sin tipo
feat: Añadido soporte  # participio, no imperativo; mayúscula
```

**Un commit = un cambio coherente.** El cuerpo explica *por qué*, no *qué* (el diff ya dice qué).

CI valida el formato de cada commit del PR. Ver `.github/workflows/ci.yml` → job `commits`.

## Pull Requests

1. Rama desde `develop`.
2. Rellena la plantilla: criterios de aceptación cumplidos, notas de migración, cómo probarlo.
3. CI debe estar en verde: `lint`, `typecheck`, `test`, `build`, migraciones y **la suite de RLS**.
4. Al menos una revisión aprobada.
5. **Squash merge** a `develop`. El título del squash debe ser un Conventional Commit.

`develop → main` se hace con un PR de *release*, con merge commit (no squash), para conservar el historial.

## Definition of Done

Ver `docs/BACKLOG.md`. En resumen, una historia está hecha cuando:

- Cumple **todos** sus criterios de aceptación.
- Tiene tests (dominio y, si aplica, e2e) y CI en verde.
- Respeta los RNF pertinentes (seguridad, accesibilidad, rendimiento).
- **RLS y guards verificados** para el recurso tocado. Si tocaste el esquema, la migración trae su política y su aserción en `supabase/tests/rls.test.sql`.
- Documentación actualizada; si cambió una decisión, hay un ADR en `docs/decisiones.md`.
- `docs/PROGRESO.md` actualizado con la evidencia.
- CodeGraph reindexado (`pnpm exec codegraph init .`).

## Antes de abrir el PR

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls.test.sql
```

## Seguridad

- **Jamás** commitees un `.env`, una clave o un token. Solo `.env.example` con valores vacíos.
- La `service_role` key no sale del servidor. En el navegador solo vive la `anon`.
- Toda tabla nueva llega con RLS activo y su política.
- Recuerda que **RLS filtra filas, no columnas**: si añades un campo de gobernanza, protégelo también con un `GRANT` por columna. Ver ADR-004.
