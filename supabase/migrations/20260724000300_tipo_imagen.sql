-- Nuevo tipo de lección IMAGE (galería de imágenes). El valor del enum se añade
-- en su propio archivo: un valor de enum nuevo debe estar *commiteado* antes de
-- poder usarse (p. ej. en el check de coherencia, que va en la migración siguiente).
alter type lesson_type add value if not exists 'IMAGE';
