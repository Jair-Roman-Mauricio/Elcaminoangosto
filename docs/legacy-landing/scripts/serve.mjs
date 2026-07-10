/**
 * Servidor estático con soporte de HTTP Range (206 Partial Content).
 *
 * Hace falta para el scrub: sin Range el navegador no puede buscar dentro
 * del video (`video.seekable` queda vacío y asignar currentTime no hace
 * nada). `python3 -m http.server` NO soporta Range — de ahí este archivo.
 *
 * Netlify, Vercel y cualquier CDN sirven Range de fábrica; esto es solo
 * para desarrollo local.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const RAIZ = process.cwd();
const PUERTO = Number(process.env.PORT ?? 4173);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (ruta.endsWith("/")) ruta += "index.html";

    // No dejar escapar de la raíz del proyecto.
    const abs = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
    if (!abs.startsWith(RAIZ)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const info = await stat(abs);
    const tipo = TIPOS[extname(abs).toLowerCase()] ?? "application/octet-stream";
    const rango = req.headers.range;

    // Sin Range: el archivo entero.
    if (!rango) {
      res.writeHead(200, {
        "Content-Type": tipo,
        "Content-Length": info.size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      createReadStream(abs).pipe(res);
      return;
    }

    // Con Range: "bytes=inicio-fin" (fin opcional).
    const m = /^bytes=(\d*)-(\d*)$/.exec(rango);
    if (!m) {
      res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
      return;
    }
    let inicio = m[1] === "" ? null : Number(m[1]);
    let fin = m[2] === "" ? null : Number(m[2]);

    if (inicio === null) {
      // "bytes=-500" = los últimos 500 bytes
      inicio = Math.max(0, info.size - (fin ?? 0));
      fin = info.size - 1;
    } else {
      fin = fin === null ? info.size - 1 : Math.min(fin, info.size - 1);
    }

    if (inicio > fin || inicio >= info.size) {
      res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
      return;
    }

    res.writeHead(206, {
      "Content-Type": tipo,
      "Content-Range": `bytes ${inicio}-${fin}/${info.size}`,
      "Content-Length": fin - inicio + 1,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    createReadStream(abs, { start: inicio, end: fin }).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
  }
}).listen(PUERTO, () => {
  console.log(`http://localhost:${PUERTO}  (con soporte de Range)`);
});
