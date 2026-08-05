-- Las estadísticas aprenden a contar las lecturas y las oraciones.
--
-- Hasta ahora `content_kind` solo conocía videos, tarjetas y canciones, así que
-- abrir un devocional, un artículo de revista o una oración guiada no dejaba
-- rastro: las secciones aparecían en las visitas pero no se sabía qué se leía
-- dentro de ellas.
--
-- Un solo valor para devocionales y artículos: los dos son filas de `lecturas`
-- y el tipo ya lo dice esa tabla. Dos valores aquí obligarían a mantener la
-- misma distinción en dos sitios y a que no se contradijeran.

alter type public.content_kind add value if not exists 'LECTURA';
alter type public.content_kind add value if not exists 'ORACION';
