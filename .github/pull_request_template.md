# Qué cambia y por qué

<!-- Una frase. Si el PR implementa una historia, enlázala: HU-4.1 · docs/BACKLOG.md -->

## Historia

- **ID:** <!-- HU-x.y, o "ninguna" si es chore/fix -->
- **Criterios de aceptación cumplidos:**
  - [ ] …

## Cómo probarlo

<!-- Pasos concretos. Un revisor debe poder reproducirlo sin preguntarte nada. -->

```bash
```

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde
- [ ] Tests nuevos para el comportamiento nuevo (dominio y/o e2e)
- [ ] Respeta las **fronteras de módulo**: ningún import del interior de otro bounded context
- [ ] Documentación actualizada; ADR nuevo si cambió una decisión
- [ ] `docs/PROGRESO.md` actualizado
- [ ] CodeGraph reindexado

## Si tocaste el esquema o la autorización

- [ ] Migración versionada en `supabase/migrations/`
- [ ] Toda tabla nueva con **RLS activo** y su política
- [ ] Campos de gobernanza protegidos con **privilegio de columna** (RLS filtra filas, no columnas — ADR-004)
- [ ] Aserción añadida a `supabase/tests/rls.test.sql`
- [ ] Guards de Nest (`RolesGuard` / `PolicyGuard`) aplicados en la ruta

## Notas de migración / despliegue

<!-- ¿Hay que ejecutar algo a mano? ¿Es reversible? ¿Rompe algo? "Ninguna" es una respuesta válida. -->
