/**
 * One-time icon generator — run with: node client/scripts/generate-icons.mjs
 *
 * Rasterizes the SIMS institutional logo (src/assets/sims-logo.png) into the
 * PWA/mobile icon set. The logo art sits on white, so every tile uses a white
 * background to blend seamlessly.
 *
 * Outputs to client/public/icons/: icon-192.png, icon-512.png,
 * icon-512-maskable.png, apple-touch-icon.png. Also (re)writes
 * client/public/favicon.svg (logo embedded as a data URI).
 *
 * Commit the generated files; rerun only when the logo changes.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const outDir = join(publicDir, 'icons');
const logoPath = join(__dirname, '../src/assets/sims-logo.png');
mkdirSync(outDir, { recursive: true });

const BG = '#ffffff';

// Render the logo at `inner` px (flattened on white so no JPEG halo), then
// center it on a `size` px white canvas. `radius` rounds the tile corners
// (transparent outside the radius); pass 0 for a full-bleed square.
async function tile({ size, inner, radius }) {
  const logo = await sharp(logoPath)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .toBuffer();

  const bg =
    radius > 0
      ? Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
            `<rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/></svg>`,
        )
      : null;

  const base = bg
    ? sharp(bg)
    : sharp({
        create: { width: size, height: size, channels: 4, background: BG },
      });

  const pad = Math.round((size - inner) / 2);
  return base
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toBuffer();
}

// "any" — rounded tile, logo padded off the edges (~86% of the canvas).
const w = async (name, buf) => {
  writeFileSync(join(outDir, name), buf);
  console.log('  ' + name);
};

await w('icon-192.png', await tile({ size: 192, inner: 166, radius: 42 }));
await w('icon-512.png', await tile({ size: 512, inner: 440, radius: 112 }));
// "maskable" — full-bleed white; logo kept inside the safe zone (center ~78%).
await w('icon-512-maskable.png', await tile({ size: 512, inner: 400, radius: 0 }));
// iOS home screen — opaque square, iOS applies its own rounding.
await w('apple-touch-icon.png', await tile({ size: 180, inner: 160, radius: 0 }));

// favicon — logo embedded as a data URI inside a rounded white tile.
const faviconPng = await sharp(logoPath)
  .resize(128, 128, { fit: 'contain', background: BG })
  .flatten({ background: BG })
  .png()
  .toBuffer();
const faviconSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">\n` +
  `  <rect width="512" height="512" rx="96" fill="${BG}"/>\n` +
  `  <image href="data:image/png;base64,${faviconPng.toString('base64')}" ` +
  `x="16" y="16" width="480" height="480"/>\n` +
  `</svg>`;
writeFileSync(join(publicDir, 'favicon.svg'), faviconSvg + '\n');
console.log('  favicon.svg');

console.log('Done — commit client/public/icons/ and client/public/favicon.svg.');
