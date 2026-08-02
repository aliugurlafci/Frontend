/**
 * Aula brand mark — an isometric stock crate whose three faces are split by thin
 * seams, with ascending "stock level" bars on the shadow face. Palette is taken
 * straight from the app's design tokens (globals.css / mobile tokens.ts):
 * CRMS red accent on cool-slate glass.
 */

export const C = {
  primary: "#e41f07",
  primaryHover: "#c81b06",
  primaryBright: "#fb4b2a",
  primaryDeep: "#8f1104",
  secondary: "#6d28d9",
  info: "#2563eb",
  bg: "#070a10",
  bg2: "#0c111b",
  bg3: "#141c2e",
  foreground: "#e8ecf3",
  muted: "#9aa6b6",
};

/* ---- geometry helpers ---------------------------------------------------- */

const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

function lineIntersect(l1, l2) {
  const { a: p1, b: p2 } = l1;
  const { a: p3, b: p4 } = l2;
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  return {
    x: (c1 * (p3.x - p4.x) - (p1.x - p2.x) * c2) / d,
    y: (c1 * (p3.y - p4.y) - (p1.y - p2.y) * c2) / d,
  };
}

/** Inward offset of a convex polygon by `d` (true offset, so seams stay even). */
export function inset(pts, d) {
  const c = centroid(pts);
  const edges = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny);
    nx /= len;
    ny /= len;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((c.x - m.x) * nx + (c.y - m.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { a: { x: a.x + nx * d, y: a.y + ny * d }, b: { x: b.x + nx * d, y: b.y + ny * d } };
  });
  // Vertex i is the intersection of edge (i-1) and edge i — keeps index parity.
  return pts.map((_, i) => lineIntersect(edges[(i - 1 + edges.length) % edges.length], edges[i]));
}

const n = (v) => Math.round(v * 1000) / 1000;
export const poly = (pts) => `M${pts.map((p) => `${n(p.x)} ${n(p.y)}`).join("L")}Z`;

/* ---- the crate ----------------------------------------------------------- */

// Isometric cube inside a 100×100 viewBox. Corner radius comes from a same-paint
// round-join stroke, so the geometry is inset by (gap/2 + stroke/2).
const T = { x: 50, y: 12.5 };
const R = { x: 82, y: 30.5 };
const B = { x: 50, y: 48.5 };
const L = { x: 18, y: 30.5 };
const B2 = { x: 50, y: 87.5 };
const L2 = { x: 18, y: 69.5 };
const R2 = { x: 82, y: 69.5 };

const FACES = {
  top: [T, R, B, L],
  left: [L, B, B2, L2],
  right: [B, R, R2, B2],
};

const STROKE = 5; // round-join stroke → ~2.5 unit corner radius
const GAP = 1.4; // half of the visible seam between faces

/** Points of a face, offset so the drawn (stroked) edge lands on the seam. */
const facePts = (name) => inset(FACES[name], GAP + STROKE / 2);

/**
 * A point on the right-hand face expressed in face-local coordinates:
 * s runs B→R (across), t runs top→bottom.
 */
function onRightFace(s, t) {
  return {
    x: B.x + s * (R.x - B.x),
    y: B.y + s * (R.y - B.y) + t * (B2.y - B.y),
  };
}

/** Ascending stock-level bars sitting in the plane of the shadow face. */
function levelBars() {
  const bars = [];
  const heights = [0.38, 0.56, 0.74];
  for (let i = 0; i < 3; i++) {
    const s0 = 0.16 + i * 0.26;
    const s1 = s0 + 0.17;
    const bottom = 0.8;
    const top = bottom - heights[i] * 0.66;
    bars.push([onRightFace(s0, top), onRightFace(s1, top), onRightFace(s1, bottom), onRightFace(s0, bottom)]);
  }
  return bars;
}

/**
 * Mark contents for a 100×100 viewBox.
 * @param {object} o
 * @param {string} o.id      unique gradient-id prefix (several marks per file)
 * @param {boolean} o.mono   flat single-colour silhouette (adaptive monochrome)
 * @param {string} o.color   paint used when mono
 * @param {boolean} o.bars   draw the stock-level bars
 * @param {boolean} o.shadow drop a soft contact shadow under the crate
 */
export function markBody({ id = "m", mono = false, color = "#ffffff", bars = true, shadow = false } = {}) {
  const s = (name, fill) =>
    `<path d="${poly(facePts(name))}" fill="${fill}" stroke="${fill}" stroke-width="${STROKE}" stroke-linejoin="round"/>`;

  if (mono) {
    // Android tints the monochrome layer through its alpha channel, so the bars
    // have to be punched out as real holes rather than painted a darker colour.
    const holes = bars
      ? `<defs><mask id="${id}-holes" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
           <rect width="100" height="100" fill="#fff"/>
           ${levelBars()
             .map(
               (b) =>
                 `<path d="${poly(inset(b, 0.6))}" fill="#000" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>`,
             )
             .join("")}
         </mask></defs>`
      : "";
    const faces = `${s("top", color)}${s("left", color)}${s("right", color)}`;
    return bars ? `${holes}<g mask="url(#${id}-holes)">${faces}</g>` : faces;
  }

  const defs = `
    <linearGradient id="${id}-top" x1="18" y1="12" x2="82" y2="49" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#ffd9d2"/>
    </linearGradient>
    <linearGradient id="${id}-left" x1="18" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.primaryBright}"/>
      <stop offset="1" stop-color="${C.primary}"/>
    </linearGradient>
    <linearGradient id="${id}-right" x1="82" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.primaryHover}"/>
      <stop offset="1" stop-color="${C.primaryDeep}"/>
    </linearGradient>
    <linearGradient id="${id}-bar" x1="50" y1="80" x2="82" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.9"/>
    </linearGradient>
    <radialGradient id="${id}-shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.primary}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${C.primary}" stop-opacity="0"/>
    </radialGradient>`;

  const shadowEl = shadow ? `<ellipse cx="50" cy="86" rx="34" ry="9" fill="url(#${id}-shadow)"/>` : "";
  const barPaths = bars
    ? levelBars()
        .map(
          (b) =>
            `<path d="${poly(inset(b, 0.6))}" fill="url(#${id}-bar)" stroke="url(#${id}-bar)" stroke-width="1.6" stroke-linejoin="round"/>`,
        )
        .join("")
    : "";

  return `<defs>${defs}</defs>${shadowEl}${s("top", `url(#${id}-top)`)}${s("left", `url(#${id}-left)`)}${s(
    "right",
    `url(#${id}-right)`,
  )}${barPaths}`;
}

/** Raw path data, so the in-app React / React Native components stay identical. */
export function facePathData() {
  return {
    top: poly(facePts("top")),
    left: poly(facePts("left")),
    right: poly(facePts("right")),
    bars: levelBars().map((b) => poly(inset(b, 0.6))),
    stroke: STROKE,
    barStroke: 1.6,
  };
}

/** Standalone mark document. */
export const markSvg = (opts = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" fill="none">${markBody(
    opts,
  )}</svg>`;

/* ---- shared backdrop ----------------------------------------------------- */

/**
 * The app's aurora-over-slate backdrop, as an icon tile. `size` is the viewBox
 * edge; `radius` rounds the tile (0 = full bleed, for iOS/Android masking).
 */
export function tileBackdrop({ id = "bg", size = 1024, radius = 0, grid = true } = {}) {
  const u = size / 1024;
  const gridStep = 64 * u;
  return `
  <defs>
    <linearGradient id="${id}-base" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.bg3}"/>
      <stop offset="0.55" stop-color="${C.bg2}"/>
      <stop offset="1" stop-color="${C.bg}"/>
    </linearGradient>
    <radialGradient id="${id}-a1" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.primary}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${C.primary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-a2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.secondary}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${C.secondary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-a3" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.info}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${C.info}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${id}-grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse">
      <path d="M${gridStep} 0V${gridStep}H0" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="${1.5 * u}"/>
    </pattern>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#${id}-base)"/>
  ${grid ? `<rect width="${size}" height="${size}" rx="${radius}" fill="url(#${id}-grid)"/>` : ""}
  <ellipse cx="${0.12 * size}" cy="${-0.02 * size}" rx="${0.62 * size}" ry="${0.62 * size}" fill="url(#${id}-a1)"/>
  <ellipse cx="${1.02 * size}" cy="${0.14 * size}" rx="${0.55 * size}" ry="${0.55 * size}" fill="url(#${id}-a2)"/>
  <ellipse cx="${0.78 * size}" cy="${1.06 * size}" rx="${0.6 * size}" ry="${0.6 * size}" fill="url(#${id}-a3)"/>`;
}

/**
 * Full icon tile: aurora backdrop + centred crate (+ its glow).
 * `scale` is the mark's share of the tile edge.
 */
export function iconTile({ size = 1024, radius = 0, scale = 0.62, grid = true, bars = true, flat = false } = {}) {
  const m = size * scale;
  const x = (size - m) / 2;
  // Optically centre: the crate's mass sits slightly high in its own box.
  const y = (size - m) / 2 + size * 0.005;
  // `flat` drops the aurora + halo — at 16px they only muddy the silhouette.
  const backdrop = flat
    ? `<defs><linearGradient id="bg-base" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
         <stop offset="0" stop-color="${C.bg3}"/><stop offset="1" stop-color="${C.bg}"/>
       </linearGradient></defs>
       <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg-base)"/>`
    : `${tileBackdrop({ id: "bg", size, radius, grid })}
       <defs><radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
         <stop offset="0" stop-color="${C.primaryBright}" stop-opacity="0.42"/>
         <stop offset="0.55" stop-color="${C.primary}" stop-opacity="0.14"/>
         <stop offset="1" stop-color="${C.primary}" stop-opacity="0"/>
       </radialGradient></defs>
       <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="url(#halo)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  ${backdrop}
  <g transform="translate(${x} ${y}) scale(${m / 100})">${markBody({ id: "mk", bars, shadow: false })}</g>
</svg>`;
}

/** Transparent mark at an arbitrary pixel size (splash, adaptive foreground…). */
export function markTile({ size = 1024, scale = 0.62, glow = false, mono = false, color = "#ffffff", bars = true } = {}) {
  const m = size * scale;
  const x = (size - m) / 2;
  const y = (size - m) / 2;
  const halo = glow
    ? `<defs><radialGradient id="g-halo" cx="0.5" cy="0.5" r="0.5">
         <stop offset="0" stop-color="${C.primaryBright}" stop-opacity="0.5"/>
         <stop offset="0.5" stop-color="${C.primary}" stop-opacity="0.18"/>
         <stop offset="1" stop-color="${C.primary}" stop-opacity="0"/>
       </radialGradient></defs>
       <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.5}" fill="url(#g-halo)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  ${halo}
  <g transform="translate(${x} ${y}) scale(${m / 100})">${markBody({ id: "mk", mono, color, bars })}</g>
</svg>`;
}
