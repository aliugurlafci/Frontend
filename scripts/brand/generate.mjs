/**
 * Renders every brand asset for the web Frontend and the Expo app from the
 * single source of truth in mark.mjs — app icons, splash, adaptive icons,
 * favicon(.ico), the PWA icons and the Open Graph card.
 *
 * Run with `npm run brand` from Frontend/. Re-runnable: every output is
 * overwritten in place, so tweaking a colour in mark.mjs re-skins both apps.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { markBody, markTile, iconTile, tileBackdrop, facePathData, C } from "./mark.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require("sharp");

// OUT_ROOT lets the same script render into a scratch mirror for review first.
const ROOT = process.env.OUT_ROOT || resolve(HERE, "../../..");
const FE = `${ROOT}/Frontend`;
const MOB = `${ROOT}/aula-crm-mobile`;
for (const d of [`${FE}/public`, `${FE}/src/app`, `${MOB}/assets/images`, `${MOB}/assets/expo.icon/Assets`]) {
  mkdirSync(d, { recursive: true });
}

const render = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
const writePng = async (path, svg, size) => {
  writeFileSync(path, await render(svg, size));
  console.log("  ✓", path.replace(ROOT + "/", ""));
};
const writeText = (path, body) => {
  writeFileSync(path, body);
  console.log("  ✓", path.replace(ROOT + "/", ""));
};

/* ---- .ico container (PNG-compressed entries) ------------------------------ */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const dir = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...pngs.map((p) => p.data)]);
}

/* ---- mobile (Expo) -------------------------------------------------------- */
console.log("mobile:");
const IMG = `${MOB}/assets/images`;

await writePng(`${IMG}/icon.png`, iconTile({ size: 1024, scale: 0.62 }), 1024);
// Web favicon: rounded tile, and a heavier mark so it survives 48px.
await writePng(`${IMG}/favicon.png`, iconTile({ size: 512, radius: 96, scale: 0.7, grid: false }), 48);
// Splash: transparent crate over the configured #0B0F1A backdrop.
await writePng(`${IMG}/splash-icon.png`, markTile({ size: 1024, scale: 0.92 }), 1024);
await writePng(`${IMG}/android-icon-background.png`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${tileBackdrop({ size: 512 })}</svg>`, 512);
// Adaptive foreground/monochrome must stay inside the 66% safe zone.
await writePng(`${IMG}/android-icon-foreground.png`, markTile({ size: 512, scale: 0.56 }), 512);
await writePng(`${IMG}/android-icon-monochrome.png`, markTile({ size: 432, scale: 0.56, mono: true, color: "#ffffff" }), 432);

// iOS Icon Composer document (assets/expo.icon).
const ICON_ASSETS = `${MOB}/assets/expo.icon/Assets`;
mkdirSync(ICON_ASSETS, { recursive: true });
// Icon Composer lays layers out in points on a 1024pt canvas (the stock Expo
// symbol was 652×606), so the layer is emitted at that scale rather than as the
// bare 100-unit mark.
writeText(`${ICON_ASSETS}/aula-crate.svg`, markTile({ size: 900, scale: 1 }));
await writePng(
  `${ICON_ASSETS}/grid.png`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
     <defs><pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse">
       <path d="M64 0V64H0" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1.5"/>
     </pattern></defs>
     <rect width="1024" height="1024" fill="url(#g)"/>
   </svg>`,
  1024,
);

/* ---- web Frontend --------------------------------------------------------- */
console.log("frontend:");
const PUB = `${FE}/public`;

// Favicon: tuned per size — at 16px the aurora and the level bars only muddy the
// silhouette, so that entry gets a flat tile and a bare crate.
const ico16 = await render(iconTile({ size: 512, radius: 96, scale: 0.84, grid: false, bars: false, flat: true }), 16);
const ico32 = await render(iconTile({ size: 512, radius: 96, scale: 0.76, grid: false, flat: true }), 32);
const ico48 = await render(iconTile({ size: 512, radius: 96, scale: 0.7, grid: false }), 48);
writeText(`${FE}/src/app/favicon.ico`, ico([
  { size: 16, data: ico16 },
  { size: 32, data: ico32 },
  { size: 48, data: ico48 },
]));
// Next.js file conventions: apple-icon.png → <link rel="apple-touch-icon">.
await writePng(`${FE}/src/app/apple-icon.png`, iconTile({ size: 1024, scale: 0.6 }), 180);

// PWA / install icons.
await writePng(`${PUB}/icon-192.png`, iconTile({ size: 1024, scale: 0.62 }), 192);
await writePng(`${PUB}/icon-512.png`, iconTile({ size: 1024, scale: 0.62 }), 512);
// Maskable: 20% padding so Android's mask never clips the crate.
await writePng(`${PUB}/icon-maskable-512.png`, iconTile({ size: 1024, scale: 0.44 }), 512);

// Note: the in-app marks are drawn by the React components (brand-mark.tsx /
// BrandMark.tsx), not by an <img>, so no standalone logo SVG is emitted — add one
// here with `markSvg({ id: "crate" })` if a static file is ever needed.

// Open Graph / Twitter card.
const OG_FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" fill="none">
  <defs>
    <linearGradient id="og-base" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.bg3}"/><stop offset="0.55" stop-color="${C.bg2}"/><stop offset="1" stop-color="${C.bg}"/>
    </linearGradient>
    <radialGradient id="og-a1" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.primary}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.primary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="og-a2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.secondary}" stop-opacity="0.42"/><stop offset="1" stop-color="${C.secondary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="og-a3" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.info}" stop-opacity="0.3"/><stop offset="1" stop-color="${C.info}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="og-grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M60 0V60H0" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1.4"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#og-base)"/>
  <rect width="1200" height="630" fill="url(#og-grid)"/>
  <ellipse cx="120" cy="40" rx="640" ry="640" fill="url(#og-a1)"/>
  <ellipse cx="1180" cy="560" rx="560" ry="560" fill="url(#og-a2)"/>
  <ellipse cx="900" cy="-40" rx="520" ry="520" fill="url(#og-a3)"/>
  <g transform="translate(96 196) scale(2.4)">${markBody({ id: "crate" })}</g>
  <text x="396" y="286" font-family="${OG_FONT}" font-size="76" font-weight="700" letter-spacing="-2" fill="#f2f5fa">Aula CRM</text>
  <text x="400" y="348" font-family="${OG_FONT}" font-size="30" font-weight="500" fill="#9aa6b6">Inventory · Point of Sale · Sales</text>
  <rect x="400" y="392" width="220" height="5" rx="2.5" fill="${C.primary}"/>
</svg>`;
writeText(
  `${PUB}/og-image.png`,
  await sharp(Buffer.from(og), { density: 192 }).resize(1200, 630).png({ compressionLevel: 9 }).toBuffer(),
);

/* ---- component path data -------------------------------------------------- */
// The in-app marks (Frontend/src/components/ui/brand-mark.tsx and the mobile
// src/components/ui/BrandMark.tsx) inline these same outlines — paste the values
// below into both if the crate's geometry ever changes.
console.log("\ncomponent path data (brand-mark.tsx / BrandMark.tsx):");
console.log(JSON.stringify(facePathData(), null, 2));
