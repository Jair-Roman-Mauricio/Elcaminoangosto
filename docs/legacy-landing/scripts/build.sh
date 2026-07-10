#!/usr/bin/env bash
# Arma dist/: la carpeta que se arrastra a Netlify.
#
# Deja fuera lo que no debe viajar: node_modules/, scripts/, shots/, y los
# videos/ originales (la web carga media/, que es la versión preparada para
# scrub). Sin esto, un drag-and-drop subiría cientos de MB.
set -euo pipefail
cd "$(dirname "$0")/.."

# media/ es imprescindible y no se regenera solo.
if [ ! -f media/1.mp4 ]; then
  echo "Falta media/. Ejecuta primero:  pnpm media"
  exit 1
fi

rm -rf dist
mkdir -p dist

cp index.html styles.css script.js netlify.toml dist/
cp -R media dist/
cp -R posters dist/

echo "dist/ listo:"
find dist -type f | sed 's|^|  |' | sort
echo
echo "peso: $(du -sh dist | cut -f1)"
echo
echo "Pruébalo:   pnpm preview      → http://localhost:4174"
echo "Súbelo:     arrastra dist/ a  https://app.netlify.com/drop"
