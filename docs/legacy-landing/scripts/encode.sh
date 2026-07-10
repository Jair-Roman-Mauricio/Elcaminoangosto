#!/usr/bin/env bash
# Prepara los videos para SCRUB (reproducción dirigida por scroll).
#
# Un H.264 normal solo puede saltar a keyframes; buscar un fotograma
# intermedio obliga a decodificar desde el keyframe anterior, y el scrub
# se ve a tirones. Con -g 1 cada fotograma es keyframe: el seek es directo.
# Cuesta ~1.5x de peso en estos clips, que son de cámara lenta.
#
#   ./scripts/encode.sh        videos/*.mp4 -> media/*.mp4 + posters/*.jpg
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p media posters

# Marca de agua del generador (el destello ✦). Está en el mismo sitio en los
# 4 clips y no se mueve ni un píxel: la tapamos interpolando desde el borde
# de la caja. Medido sobre 1280x720; la estrella ocupa x 1143-1183, y 577-623
# y la caja lleva ~7px de margen para atrapar su halo. Con una caja más
# ajustada asoman las puntas.
#
# Si cambias de videos y la marca está en otro sitio, localízala con:
#   ffmpeg -i videos/1.mp4 -frames:v 1 -vf "crop=200:160:1080:560,scale=600:480:flags=neighbor" /tmp/wm.png
MARCA="delogo=x=1136:y=570:w=56:h=60"

for i in 1 2 3 4; do
  src="videos/$i.mp4"
  [ -f "$src" ] || { echo "falta $src"; exit 1; }

  echo "→ $src"
  ffmpeg -y -v error -i "$src" \
    -vf "$MARCA" \
    -c:v libx264 -g 1 -crf 27 -preset slow \
    -pix_fmt yuv420p -movflags +faststart -an \
    "media/$i.mp4"

  # Poster: primer fotograma, que es el que se ve antes de scrollear.
  # Se saca del video ya limpio, o la marca reaparecería en el poster.
  ffmpeg -y -v error -i "media/$i.mp4" -frames:v 1 -q:v 4 "posters/$i.jpg"
done

echo
ls -lh media/*.mp4 | awk '{print "  " $9, $5}'
echo "total: $(du -sh media | cut -f1)"
