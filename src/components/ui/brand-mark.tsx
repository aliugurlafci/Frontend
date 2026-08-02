/**
 * Aula brand mark — an isometric stock crate (three seam-split faces) with the
 * ascending stock-level bars on its shadow face. The paint comes from the theme
 * tokens (`--primary` / `--primary-hover`), so a custom accent recolours the mark
 * along with the rest of the UI.
 *
 * Same geometry as the generated app icons in `public/logo-mark.svg` and the
 * mobile app's `BrandMark` — keep the three in sync if the shape ever changes.
 */

/** Face outlines, inset so the round-join stroke lands exactly on the seam. */
const TOP = "M50 16.975L74.045 30.5L50 44.025L25.955 30.5Z";
const LEFT = "M21.9 37.168L46.1 50.781L46.1 80.832L21.9 67.219Z";
const RIGHT = "M53.9 50.781L78.1 37.168L78.1 67.219L53.9 80.832Z";
const BARS = [
  "M55.72 67.39L59.96 65.005L59.96 73.409L55.72 75.794Z",
  "M64.04 58.077L68.28 55.692L68.28 68.729L64.04 71.114Z",
  "M72.36 48.763L76.6 46.378L76.6 64.049L72.36 66.434Z",
];

/* Gradient ids are fixed rather than per-instance: every instance declares the
   same stops, so the first definition in the document resolves identically for
   all of them (and this stays usable from server components). */
const ID = "aula-mark";

export function BrandMark({
  className,
  title,
  bars = true,
}: {
  className?: string;
  /** Accessible name; omit to render the mark as decoration. */
  title?: string;
  /** Drop the stock-level bars — they blur below ~20px. */
  bars?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={`${ID}-top`} x1="18" y1="12" x2="82" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffd9d2" />
        </linearGradient>
        {/* Both side faces are derived from `--primary` with color-mix (rather than
            `--primary-hover`, which is lighter in dark mode and darker in light)
            so the lit/shadow relationship holds for any accent. `style` — not the
            presentation attribute — because that is where var() is reliable. */}
        <linearGradient id={`${ID}-left`} x1="18" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--primary) 80%, #ffffff)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary)" }} />
        </linearGradient>
        <linearGradient id={`${ID}-right`} x1="82" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--primary) 84%, #000000)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--primary) 58%, #000000)" }} />
        </linearGradient>
        <linearGradient id={`${ID}-bar`} x1="50" y1="80" x2="82" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.92" />
        </linearGradient>
      </defs>
      {/* Fill + same-paint round-join stroke is what rounds the crate's corners. */}
      {(
        [
          [TOP, `${ID}-top`],
          [LEFT, `${ID}-left`],
          [RIGHT, `${ID}-right`],
        ] as const
      ).map(([d, id]) => (
        <path key={id} d={d} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth={5} strokeLinejoin="round" />
      ))}
      {bars
        ? BARS.map((d) => (
            <path key={d} d={d} fill={`url(#${ID}-bar)`} stroke={`url(#${ID}-bar)`} strokeWidth={1.6} strokeLinejoin="round" />
          ))
        : null}
    </svg>
  );
}

/**
 * Brand lockup used in the shell chrome and on the auth screens: the crate in a
 * soft accent-tinted glass badge, optionally followed by the wordmark.
 */
export function BrandLockup({
  wordmark = true,
  size = "sm",
  className = "",
}: {
  wordmark?: boolean;
  size?: "sm" | "lg";
  className?: string;
}) {
  const badge = size === "lg" ? "h-11 w-11 rounded-2xl" : "h-8 w-8 rounded-xl";
  const mark = size === "lg" ? "h-8 w-8" : "h-6 w-6";
  const text = size === "lg" ? "text-2xl font-bold" : "text-sm font-semibold";
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/10 ring-1 ring-primary/20 shadow-[0_6px_18px_-8px_var(--primary)] ${badge}`}
      >
        <BrandMark className={mark} title={wordmark ? undefined : "Aula CRM"} />
      </span>
      {wordmark ? <span className={`tracking-tight ${text}`}>Aula CRM</span> : null}
    </span>
  );
}
