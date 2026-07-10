# El Camino Angosto — Documentación del proyecto

Plataforma cristiana con tres módulos — **Alabanza** (música, tipo Spotify), **Tarjetas de Fe** (feed de video/imagen, tipo TikTok) y **Discipulado** (cursos por niveles, tipo Udemy) — más **chat mentor**. Basado en Mateo 7:13–14.

**Stack:** pnpm + Turborepo · React + Vite + TypeScript + Tailwind · NestJS (monolito modular) · Supabase (Postgres/Auth/Storage/Realtime) · BullMQ + Redis · Railway (hosting) · CodeGraph (contexto para agentes).

## Mapa de documentos

| Documento | Para qué sirve | Léelo si… |
|---|---|---|
| [`contexto.md`](./contexto.md) | Visión, roles, reglas de negocio, alcance del MVP, máquina de estados de cursos. | quieres entender **qué** se construye y **por qué**. |
| [`arquitectura.md`](./arquitectura.md) | Monolito modular, patrones de diseño, stack detallado, modelo de datos, seguridad (JWKS) y estrategia de medios. | vas a tomar decisiones técnicas o tocar el backend/datos. |
| [`DESIGN.md`](./DESIGN.md) | Sistema de diseño derivado de la landing: tokens, tipografía (escala 10px), motion *spring*, componentes. | vas a construir UI o migrar la landing. |
| [`BACKLOG.md`](./BACKLOG.md) | Épicas, historias de usuario, RF/RNF, criterios de aceptación (Gherkin) y plan de sprints S0–S6. | vas a planificar o implementar una historia. |
| [`AGENTS.md`](./AGENTS.md) | Reglas para agentes de IA (Claude Code), convenciones, fronteras de módulo y uso de CodeGraph. | eres (o configuras) un agente que va a codificar. |
| [`PROMPT_CLAUDE_CODE.md`](./PROMPT_CLAUDE_CODE.md) | Prompt maestro para arrancar el desarrollo con Claude Code (andamiaje + sprints). | quieres empezar a construir ya. |

## Orden de lectura sugerido

1. `contexto.md` → 2. `arquitectura.md` → 3. `DESIGN.md` → 4. `BACKLOG.md` → 5. `AGENTS.md` → 6. `PROMPT_CLAUDE_CODE.md`.

## Cómo empezar

1. Crea el repositorio y coloca estos archivos en `docs/`. Pon tu landing HTML actual en `docs/legacy-landing/`.
2. Instala **CodeGraph** y regístralo como servidor MCP en tu cliente de Claude Code.
3. Abre `PROMPT_CLAUDE_CODE.md`, copia el bloque de prompt y pégalo como primer mensaje a Claude Code.
4. Valida los **hitos demostrables** al final de cada sprint.

## Roles

- **ESTUDIANTE** — consume todo el contenido; se inscribe a cursos según su nivel; chatea con su mentor; solicita subir de nivel.
- **MAESTRO** — gestiona a sus estudiantes; crea cursos (borrador → aprobación del admin); tiene "vista de estudiante".
- **ADMIN** — control absoluto: aprueba cursos, gestiona usuarios/roles y modera todo el contenido.

## Documentos que generará el desarrollo (aún no incluidos aquí)

- `decisiones.md` — ADRs (registro de decisiones de arquitectura) que Claude Code irá creando.
- `PROGRESO.md` — checklist de historias completadas por sprint.
- OpenAPI/Swagger — contrato vivo de la API (auto-generado por NestJS).
