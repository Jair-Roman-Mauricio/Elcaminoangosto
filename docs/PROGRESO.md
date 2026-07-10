# PROGRESO.md — Checklist de historias

Estado real, verificado contra el código y contra la base de datos. Una historia solo se marca ✅ si cumple **todos** sus criterios de aceptación y su verificación consta en este documento.

Leyenda: ✅ hecha · 🟡 parcial · ⬜ pendiente

---

## Fase A — Andamiaje

| | Entregable | Verificación |
|---|---|---|
| ✅ | Monorepo pnpm + Turborepo | `pnpm install && pnpm build` en limpio: 5/5 tareas |
| ✅ | `packages/config` con preset de Tailwind | Tokens reales de la landing (ADR-001) |
| ✅ | `packages/shared-types` | 8 tests de la máquina de estados en verde |
| ✅ | `packages/ui` | Eyebrow, Boton, Card, Nav, Reveal, Verse, PlayPause, ProgressBar |
| ✅ | `apps/api` — 10 bounded contexts | `nest build` limpio; fronteras de módulo verificadas con violaciones deliberadas |
| ✅ | `apps/worker` — BullMQ + MediaProvider | `tsc` limpio; transcodificación pendiente (HU-8.2) |
| ✅ | `supabase/` — 26 tablas, RLS, 5 buckets, seed | `supabase db reset` limpio; 16/16 aserciones de RLS |
| ✅ | `apps/web` — Vite, router por rol, Query, Zustand | `vite build` limpio |
| ✅ | CI/CD | `.github/workflows/{ci,deploy}.yml` — **no ejecutado aún** (falta `gh auth`) |
| ✅ | CodeGraph | 98 archivos, 710 nodos, 1 292 aristas; telemetría desactivada |
| ✅ | ADRs | `docs/decisiones.md` — ADR-001..004, preguntas Q-1..Q-4 |

---

## S0 — Fundaciones

| | Historia | Estado |
|---|---|---|
| ✅ | **HU-0.1** Scaffolding del monorepo | `pnpm install && pnpm build` compila `web`, `api`, `worker` y los 3 packages. `lint`/`typecheck`/`test`/`build` orquestados por Turborepo. |
| ✅ | **HU-0.2** Autenticación base (Supabase + JWKS) | Verificado de punta a punta contra Supabase local (ver tabla abajo). |
| 🟡 | **HU-0.3** CI/CD a Railway + migraciones | Workflows escritos y migraciones versionadas. **Sin ejecutar**: falta autenticar `gh` y crear el proyecto Railway (Q-3, Q-4). |
| ✅ | **HU-0.4** Design system base y tokens | Preset de Tailwind + `packages/ui`. Página de muestra en `/kit-ui`. *Sin `Marquee`*: no existe en la landing y choca con su estética (Q-1). |
| ✅ | **HU-0.5** CodeGraph indexado | `codegraph status` → 710 símbolos. Uso documentado en `AGENTS.md` §5. |
| ⬜ | **HU-1.1** Perfil de usuario | `GET/PATCH /users/me` implementados. Falta la subida de avatar al bucket y la pantalla. |

### Evidencia de HU-0.2

Ejecutado contra el stack local (`supabase start` + `node dist/main.js`):

| Caso | Esperado | Obtenido |
|---|---|---|
| `GET /api/health` (ruta `@Public`) | 200 | ✅ 200 |
| `GET /api/users/me` sin token | 401 | ✅ 401 |
| `GET /api/users/me` con token malformado | 401 | ✅ 401 |
| `GET /api/users/me` con **JWT HS256** firmado con el secreto legacy | 401 | ✅ 401 |
| `GET /api/users/me` con **JWT ES256** verificado por JWKS | 200 + perfil | ✅ 200, `role=ESTUDIANTE`, `levelRank=2` |
| Registro → fila en `profiles` con rol `ESTUDIANTE` | sí | ✅ trigger `crear_perfil_al_registrarse` |
| `PATCH /users/:id/role` como ESTUDIANTE | 403 | ✅ 403 (`RolesGuard`) |
| `PATCH /users/:id/role` con rol inexistente | 400 | ✅ 400 (`ZodValidationPipe`) |
| `PATCH /users/:id/role` como ADMIN | 200 | ✅ 200 |

### Evidencia de RLS (`supabase/tests/rls.test.sql`)

16 aserciones, todas en verde. Las relevantes:

- 26/26 tablas con RLS activo y **forzado**.
- Esteban (nivel 1) y Ester (nivel 2) **no ven** un curso de nivel 3; el maestro dueño y el admin sí.
- Un ESTUDIANTE **no puede** ascenderse a ADMIN ni subirse de nivel solo — pero **sí** edita su nombre.
- Un MAESTRO **no puede autopublicar** su curso; **sí** puede enviarlo a revisión.
- El autor **no puede** revertir la ocultación por moderación de su tarjeta.
- Un no inscrito lee 0 lecciones; una inscrita lee las 3.
- Un tercero ve 0 mensajes de una conversación ajena; el mentor y el admin, 1.
- Un estudiante solo ve canciones `is_published = true`.

---

## Sprints siguientes

Ninguna historia empezada. El esqueleto de módulos y las rutas placeholder ya señalan dónde va cada una.

| Sprint | Historias | Estado |
|---|---|---|
| **S1** Identidad & Discipulado I | HU-1.2 🟡 *(endpoint hecho, sin UI)*, HU-1.3, HU-4.1, HU-4.2 | ⬜ |
| **S2** Discipulado II & Aprobación | HU-4.3, 4.4, 4.5, 5.1, 5.2, 5.3 | ⬜ |
| **S3** Medios & Feed | HU-8.1, 8.2, 8.3, 3.1, 3.3 | ⬜ |
| **S4** Feed social & Chat | HU-3.2, 3.4, 6.1, 6.2 | ⬜ |
| **S5** Alabanza | HU-2.1 🟡 *(store + player bar)*, 2.2, 2.3, 2.4 | ⬜ |
| **S6** Admin & Landing & Hardening | HU-7.1, 7.2, 9.1 + RNF | ⬜ |

---

## Bloqueos actuales

| # | Bloqueo | Qué desbloquea | Acción del responsable humano |
|---|---|---|---|
| 1 | `gh` sin autenticar | `git push` al repositorio remoto | `gh auth login` |
| 2 | Sin proyecto Supabase remoto | Aplicar migraciones a staging/producción | Crear proyecto y dar `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` |
| 3 | Sin proyecto Railway | Desplegar `api`, `worker`, `web` + plugin Redis | `railway init` (crea infraestructura facturable) y `RAILWAY_TOKEN` en GitHub |

Todo el desarrollo local funciona sin ninguno de los tres: `supabase start` levanta Postgres, Auth, Storage y Realtime.
