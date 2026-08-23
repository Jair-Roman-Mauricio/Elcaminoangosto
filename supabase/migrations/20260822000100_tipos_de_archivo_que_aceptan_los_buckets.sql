-- ═══════════════════════════════════════════════════════════════════════════
-- Los buckets aceptan lo que los formularios ofrecen subir
--
-- `feed-media` no admitía NINGÚN tipo de audio, pero el panel de oraciones
-- guiadas sube ahí la voz y el de Tarjetas de Fe el relato hablado. Storage
-- rechazaba el archivo y la subida moría antes de llegar al API: por eso no
-- había ni una sola oración publicada en producción.
--
-- Lo mismo en `music`, por partida doble: el formulario de canciones ofrece
-- OGG y el bucket solo aceptaba MP3, MP4, AAC y WAV; y el fondo en video de
-- una canción va a ese mismo bucket, que no admitía vídeo ninguno.
--
-- Se incluye además lo que el worker ESCRIBE de vuelta en el bucket del
-- original: el MP4 normalizado y el póster en JPEG. Sin eso, transcodificar
-- termina bien y el resultado no se puede guardar.
--
-- La migración que creó los buckets lleva `on conflict do nothing`, así que
-- volver a ejecutarla no habría cambiado nada: hay que actualizar.
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
   set allowed_mime_types = array[
     -- la canción
     'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg',
     -- el fondo en video, y el MP4 que devuelve el worker
     'video/mp4', 'video/quicktime',
     -- el póster que extrae el worker
     'image/jpeg',
     -- HLS, cuando se active (ADR-006)
     'application/vnd.apple.mpegurl', 'video/mp2t'
   ]
 where id = 'music';

update storage.buckets
   set allowed_mime_types = array[
     -- la voz de una oración, el relato hablado de una tarjeta
     'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg',
     'video/mp4', 'video/quicktime',
     'image/jpeg', 'image/png', 'image/webp',
     'application/vnd.apple.mpegurl', 'video/mp2t'
   ]
 where id = 'feed-media';
