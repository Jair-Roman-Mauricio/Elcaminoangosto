# AGENTS.md — Reglas para agentes de IA (Claude Code) · El Camino Angosto

> Este archivo lo lee **Claude Code** (y otros agentes) al inicio de cada sesión. Define cómo trabajar en este repo: contexto, convenciones, límites y el uso de **CodeGraph** como grafo de contexto. Es de lectura obligatoria antes de escribir código.

---

## 1. Orden de lectura al arrancar

1. `docs/contexto.md` — qué es el producto y sus reglas de negocio.
2. `docs/arquitectura.md` — cómo está estructurado (monolito modular, patrones, modelo de datos).
3. `docs/DESIGN.md` — sistema de diseño (tokens, tipografía, motion).
4. `docs/BACKLOG.md` — historia/sprint en curso y criterios de aceptación.
5. Consultar **CodeGraph** para ubicar el código relevante antes de leer archivos a ciegas.

## 2. Contexto del proyecto (resumen ejecutable)

- **Producto:** plataforma cristiana con 3 módulos — música (Spotify-like), feed (TikTok-like), discipulado (Udemy-like) + chat mentor.
- **Roles:** ESTUDIANTE, MAESTRO, ADMIN.
- **Stack:** pnpm + Turborepo · React+Vite+TS+Tailwind (web) · NestJS (api, monolito modular) · Supabase (Postgres/Auth/Storage/Realtime) · BullMQ+Redis (jobs) · Railway (hosting) · Supabase (DB/Storage, fuera de Railway).
- **Regla de oro de autorización:** el rol define capacidades; **propiedad del recurso y nivel** definen el acceso fino. RLS es defensa en profundidad; la autorización primaria vive en guards de Nest.

## 3. Estructura del monorepo (dónde va cada cosa)

```
apps/web        → React + Vite (frontend + landing migrada)
apps/api        → NestJS (módulos = bounded contexts)
apps/worker     → jobs async (transcodificación, notificaciones)
packages/ui     → design system (componentes React)
packages/shared-types → contratos DTO/API compartidos
packages/config → tailwind preset, eslint, tsconfig
supabase/       → migraciones SQL, políticas RLS, seed
docs/           → toda la documentación
.codegraph/     → índice del grafo (generado; no editar a mano)
```

**Módulos de `apps/api`:** `auth`, `users`, `music`, `feed`, `discipleship`, `chat`, `media`, `admin`, `notifications`, `shared`. Cada uno con capas `interface / application / domain / infrastructure`.

## 4. Convenciones de código

- **Lenguaje:** TypeScript estricto (`strict: true`) en todo el monorepo. Nada de `any` salvo justificación puntual.
- **Nombres:** módulos y archivos en `kebab-case`; clases en `PascalCase`; variables/funciones en `camelCase`; constantes en `UPPER_SNAKE`.
- **Fronteras de módulo (crítico):** un módulo **nunca** importa el repositorio o las entidades internas de otro módulo. Si necesita algo de otro contexto, lo pide por el **servicio público** de ese módulo o reacciona a un **evento de dominio** (`EventEmitter2`). Esto mantiene el monolito "modular" de verdad.
- **Dependencias hacia adentro:** `domain` no importa de `infrastructure` ni de `interface`. El acceso a Supabase/Drizzle vive en `infrastructure` detrás de interfaces (puertos).
- **Validación:** DTOs validados con Zod (`nestjs-zod`) o class-validator; los esquemas Zod se comparten con el front vía `packages/shared-types` cuando aplique.
- **Errores:** usar excepciones de Nest (`NotFoundException`, `ForbiddenException`, …) + un `HttpExceptionFilter` global. Nunca filtrar detalles internos al cliente.
- **Estado front:** servidor con TanStack Query; cliente con Zustand. No duplicar estado servidor en Zustand.
- **Estilos:** solo tokens de `DESIGN.md` vía Tailwind/CSS vars. No inventar colores ni tamaños fuera de la escala.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). Un commit = un cambio coherente.
- **Tests:** dominio con cobertura ≥ 70%; flujos críticos con e2e. Un PR no pasa sin CI verde.

## 5. Uso de CodeGraph (grafo de contexto)

**Qué es:** CodeGraph es un grafo de conocimiento local del código (símbolos, llamadas, imports, dependencias) que se expone por **MCP** a agentes como Claude Code. Evita explorar el repo con `grep`/`glob`/`read` archivo por archivo: el agente pregunta al grafo y obtiene el código relevante en una llamada, ahorrando tokens y tiempo.

**Setup (una vez):**
```bash
# instalar CodeGraph (ver repo oficial: github.com/colbymchenry/codegraph)
codegraph init            # parsea el repo y crea .codegraph/ (SQLite)
codegraph status          # debe reportar Backend: native y symbols > 0
```
- El servidor MCP de CodeGraph debe estar registrado en el cliente del agente (Claude Code detecta y ofrece `codegraph init -i`).
- **Reindexar** tras cambios grandes o dejar el auto-sync activo. En CI, reindexar es parte del DoD.

**Cómo debe usarlo el agente (obligatorio):**
1. Antes de implementar una historia, **consulta el grafo** para localizar los símbolos/módulos afectados (p. ej. "dónde se resuelve la autorización por nivel", "quién emite `CoursePublished`").
2. Usa el grafo para **análisis de impacto** antes de refactorizar (callers/dependientes).
3. Solo lee archivos completos cuando el grafo ya te haya señalado los relevantes.
4. Si `codegraph status` reporta 0 símbolos, re-ejecuta `codegraph init` antes de continuar.

## 6. Flujo de trabajo por historia (Scrum)

1. Lee la historia y sus criterios de aceptación en `BACKLOG.md`.
2. Localiza el código con CodeGraph. Escribe un plan corto (qué archivos, qué módulo, qué eventos).
3. Implementa respetando capas y fronteras de módulo.
4. Añade/actualiza tests (dominio + e2e si aplica) y migraciones Supabase si tocas el esquema.
5. Verifica RNF pertinentes (seguridad/RLS/guards, accesibilidad, rendimiento).
6. Corre `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
7. Abre PR con descripción, criterios cumplidos y notas de migración. Reindexa CodeGraph.
8. Actualiza documentación si cambió una decisión (`arquitectura.md`/`contexto.md`).

## 7. Reglas de seguridad y datos

- **Nunca** hardcodear secretos ni claves. Usar variables de entorno (`.env` local, secretos de Railway/Supabase en despliegue). El `.env` real jamás se commitea; mantener `.env.example`.
- **Auth:** verificar JWT por **JWKS asimétrico** de Supabase (no HS256 legacy).
- **RLS activo** en todas las tablas; toda tabla nueva llega con su política.
- **Medios privados** solo por **URL firmada** de corta vida, tras validar rol/propiedad/nivel/inscripción.
- **Contenido de usuario** (feed/chat/comentarios) siempre sanitizado (anti-XSS) y sujeto a moderación.
- **Menores / seguridad infantil:** dado el carácter de la plataforma, tratar con especial cuidado datos y contenido que involucren a menores; no construir features que faciliten contacto no supervisado ni exposición indebida. Ante la duda, escalar al responsable humano, no improvisar.

## 8. Qué NO hacer (guardarraíles del agente)

- No romper fronteras de módulo (no imports cruzados de infраestructura/entidades).
- No introducir microservicios ni colas nuevas sin que una historia lo pida.
- No cambiar el stack acordado (pnpm, React+Vite, NestJS, Supabase, Railway) sin aprobación humana.
- No inventar endpoints o tablas fuera del modelo de datos sin actualizar `arquitectura.md`.
- No desactivar RLS ni usar la *service key* para operaciones de usuario normales.
- No añadir dependencias pesadas sin justificar (peso, mantenimiento, licencia).
- No dejar `TODO` silenciosos: si algo queda pendiente, crear una historia/nota en `BACKLOG.md`.
- No autopublicar cursos de maestros: **siempre** pasan por aprobación del admin.

## 9. Comandos frecuentes

```bash
pnpm install                 # instalar todo el workspace
pnpm dev                     # levantar web + api en desarrollo (Turborepo)
pnpm --filter api dev        # solo la API
pnpm --filter web dev        # solo el frontend
pnpm lint && pnpm typecheck  # calidad
pnpm test                    # tests
pnpm build                   # build de producción
supabase migration new <n>   # nueva migración
supabase db push             # aplicar migraciones
codegraph init               # (re)indexar el grafo de código
```

## 10. Definición de "hecho" para el agente
Ver **DoD** en `BACKLOG.md`. Un cambio no está terminado hasta que pasa CI, cumple criterios de aceptación, respeta RNF y deja el grafo reindexado.
