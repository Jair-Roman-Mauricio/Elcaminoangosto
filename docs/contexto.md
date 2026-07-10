# contexto.md — El Camino Angosto

> **Fuente de verdad del "por qué" y el "qué" del proyecto.**
> Este documento es la referencia de contexto que todos los agentes de IA (Claude Code + CodeGraph) y humanos deben leer antes de tocar código. Si algo aquí contradice el código, gana este documento hasta que se actualice explícitamente.

---

## 1. Visión

**El Camino Angosto** es una plataforma cristiana de formación y comunidad que reúne, en un solo lugar, tres experiencias que hoy viven fragmentadas en apps seculares:

1. **Alabanza (tipo Spotify)** — streaming de música cristiana.
2. **Tarjetas de Fe (tipo TikTok)** — feed vertical de videos e imágenes devocionales.
3. **Discipulado (tipo Udemy)** — cursos por niveles impartidos por maestros, con chat directo mentor–estudiante.

El nombre nace de **Mateo 7:13–14**: *"Entrad por la puerta angosta… porque angosta es la puerta, y angosto el camino que lleva a la vida"*. La plataforma acompaña a la persona en ese camino: adorar, edificarse y discipularse.

## 2. Propuesta de valor

- **Un solo hogar digital** para el creyente: música, contenido corto y formación seria.
- **Discipulado real, no solo cursos**: relación con un mentor, progreso por niveles y solicitud explícita de "subir de nivel".
- **Contenido con gobernanza**: los maestros proponen; el admin aprueba. Se protege la sana doctrina y la calidad.

## 3. Alcance del MVP (qué SÍ construimos primero)

| Módulo | MVP incluye | Queda para después |
|---|---|---|
| **Auth & Perfiles** | Registro/login (Supabase Auth), roles, perfil básico | SSO con Google/Apple, verificación de maestros por documento |
| **Alabanza (música)** | Reproductor, catálogo, playlists, búsqueda, "me gusta" | Recomendaciones personalizadas, letras sincronizadas, descargas offline |
| **Tarjetas de Fe (feed)** | Feed vertical de video/imagen, like, comentario, compartir | Algoritmo de recomendación avanzado, duetos, filtros/edición |
| **Discipulado (cursos)** | Catálogo por nivel, inscripción, lecciones video/texto, progreso, flujo de aprobación de cursos, vista de estudiante para el maestro | Certificados, evaluaciones/quizzes automáticos, rutas de aprendizaje |
| **Chat mentor** | Chat 1:1 estudiante–mentor, solicitud de subida de nivel | Grupos, llamadas, adjuntos enriquecidos |
| **Admin** | Panel de aprobación, gestión de usuarios, moderación básica | Analítica avanzada, reportes, feature flags por rol |

## 4. Usuarios y roles

### 4.1 ESTUDIANTE
- Consume TODO el contenido (música, feed, cursos permitidos por su nivel).
- Se inscribe a cursos **según su nivel** (algunos gratis y abiertos, otros gated por nivel/maestro).
- Chatea con su mentor y puede **solicitar subir de nivel**.

### 4.2 MAESTRO
- Gestiona a **sus** estudiantes (los inscritos en sus cursos / asignados como mentor).
- **Crea cursos y sube contenido**, pero NO se publica solo: envía un **borrador** (idea + N módulos planificados) al admin para revisión y aprobación.
- Tiene una **"vista de estudiante"** para experimentar el curso tal como lo ve el alumno.
- Aprueba/rechaza **solicitudes de subida de nivel** de sus estudiantes.

### 4.3 ADMIN
- **Control absoluto**: aprueba/rechaza cursos, gestiona usuarios y roles, modera contenido de todos los módulos, publica música y tarjetas, y ve toda la analítica.

> Regla de oro de autorización: **el rol define capacidades; la propiedad del recurso y el nivel definen el acceso fino.** Un maestro solo edita SUS cursos; un estudiante solo entra a cursos de su nivel o inferiores; el admin no tiene restricciones de propiedad.

## 5. Máquina de estados clave — Publicación de un curso

```
DRAFT ──(maestro envía)──► SUBMITTED ──(admin toma)──► UNDER_REVIEW
                                                          │
                        ┌─────────────────────────────────┤
                        ▼                                  ▼
                    REJECTED  ──(maestro corrige)──►   APPROVED ──(publica)──► PUBLISHED
                        │                                                          │
                        └───────────────► (vuelve a DRAFT)          ARCHIVED ◄─────┘
```

- **DRAFT**: el maestro arma la idea y los módulos. Editable libremente.
- **SUBMITTED**: enviado a revisión; el maestro ya no puede editar estructura crítica.
- **UNDER_REVIEW**: un admin lo está revisando.
- **APPROVED**: aprobado; puede publicarse.
- **PUBLISHED**: visible para estudiantes elegibles.
- **REJECTED**: con notas del admin; vuelve a manos del maestro.
- **ARCHIVED**: retirado sin borrar.

## 6. Stack (decisión tomada)

- **Gestor de paquetes:** pnpm (monorepo con workspaces + Turborepo).
- **Frontend:** React + Vite + TypeScript + TailwindCSS. Migración de la landing actual (HTML/CSS/JS) a React conservando la identidad visual (ver `DESIGN.md`).
- **Backend:** NestJS + TypeScript (monolito modular).
- **BBDD + Auth + Storage + Realtime:** Supabase (Postgres, Supabase Auth, buckets, Realtime).
- **Hosting de la app (API + worker + frontend):** Railway.
- **Grafo de contexto para agentes:** CodeGraph (MCP local).
- Tecnologías complementarias recomendadas y justificadas en `arquitectura.md`.

## 7. Principios de producto (guardarraíles)

1. **Doctrina y seguridad primero**: nada de contenido sin gobernanza. Toda subida de maestros pasa por aprobación.
2. **Accesible**: gratis por defecto donde se pueda; el gating es por nivel/madurez, no por dinero (en el MVP no hay pagos).
3. **Móvil primero**: el feed y la música se consumen en el teléfono.
4. **Rendimiento y coste**: streaming eficiente, URLs firmadas, transcodificación asíncrona.
5. **Escalable por diseño**: monolito modular que pueda partirse en servicios si el tráfico lo exige, sin reescribir dominio.

## 8. Métricas de éxito (North Star + apoyo)

- **North Star:** minutos semanales de discipulado activo por usuario (lecciones + interacción con mentor).
- Apoyo: retención D7/D30, cursos completados, tarjetas publicadas/semana, tiempo de escucha, tasa de aprobación de cursos, latencia de arranque de video (<2 s p75).

## 9. Glosario

- **Tarjeta de Fe**: pieza de contenido corto (video vertical o imagen) del feed.
- **Nivel**: grado de madurez/avance del estudiante que habilita cursos.
- **Mentor**: maestro asignado que discipula 1:1 a un estudiante.
- **Borrador (draft)**: propuesta de curso pendiente de aprobación del admin.
- **Vista de estudiante**: modo en que el maestro previsualiza el curso como lo ve el alumno.

## 10. Documentos relacionados

- `arquitectura.md` — arquitectura, patrones de diseño, stack detallado, modelo de datos.
- `DESIGN.md` — sistema de diseño derivado de la landing.
- `BACKLOG.md` — épicas, historias de usuario, RF/RNF, criterios de aceptación, sprints.
- `AGENTS.md` — reglas de operación para Claude Code y configuración de CodeGraph.
- `PROMPT_CLAUDE_CODE.md` — prompt maestro para arrancar el desarrollo.
