/**
 * Line drawings for the home page: one per card, and a faint set behind the heading.
 * Drawn in the logo's violets so they read as part of the brand. All decorative (aria-hidden).
 */

// Theme colours (Appearance in the admin portal). Set as styles: SVG attributes cannot read CSS variables.
const STROKE = "var(--accent)";
const FILL = "var(--accent-strong)";
const LIGHT = "var(--accent-pale)";

/** An isometric block: top, left and right faces around (cx, cy) as the top face's lowest corner. */
function Block({ cx, cy, s, h = s, o = 1 }: { cx: number; cy: number; s: number; h?: number; o?: number }) {
  const w = s * 0.866;
  const top = `${cx},${cy - s} ${cx + w},${cy - s / 2} ${cx},${cy} ${cx - w},${cy - s / 2}`;
  const left = `${cx - w},${cy - s / 2} ${cx},${cy} ${cx},${cy + h} ${cx - w},${cy + h - s / 2}`;
  const right = `${cx + w},${cy - s / 2} ${cx},${cy} ${cx},${cy + h} ${cx + w},${cy + h - s / 2}`;
  return (
    <g opacity={o} style={{ stroke: STROKE }} strokeWidth="1.4" strokeLinejoin="round">
      <polygon points={left} style={{ fill: FILL }} fillOpacity="0.32" />
      <polygon points={right} style={{ fill: FILL }} fillOpacity="0.18" />
      <polygon points={top} style={{ fill: FILL }} fillOpacity="0.5" />
    </g>
  );
}

/** The logo's feather as an outline, centred on (x, y). */
function Feather({ x, y, scale = 1, o = 1 }: { x: number; y: number; scale?: number; o?: number }) {
  return (
    <g transform={`translate(${x - 64 * scale} ${y - 64 * scale}) scale(${scale}) rotate(-28 64 64)`} opacity={o} style={{ stroke: STROKE }} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M64 8 C78 18 92 40 90 62 C88 78 78 88 70 94 L70 108 L64 124 L58 108 L58 94 C50 88 40 78 38 62 C36 40 50 18 64 8Z"
        style={{ fill: FILL }}
        fillOpacity="0.28"
        strokeWidth={1.4 / scale}
      />
      <path d="M64 14 L64 108" style={{ stroke: LIGHT }} strokeWidth={1.6 / scale} />
      <g strokeWidth={1 / scale} strokeOpacity="0.7">
        <path d="M62 30 L46 42" />
        <path d="M62 46 L42 58" />
        <path d="M62 62 L46 72" />
        <path d="M66 30 L82 42" />
        <path d="M66 46 L86 58" />
        <path d="M66 62 L82 72" />
      </g>
    </g>
  );
}

/** A window with a title bar, at (x, y). */
function Window({ x, y, w, h, o = 1, children }: { x: number; y: number; w: number; h: number; o?: number; children?: React.ReactNode }) {
  return (
    <g opacity={o} style={{ stroke: STROKE }} strokeWidth="1.4">
      <rect x={x} y={y} width={w} height={h} rx="8" style={{ fill: FILL }} fillOpacity="0.22" />
      <path d={`M${x} ${y + 18} H${x + w}`} strokeOpacity="0.6" />
      <circle cx={x + w - 30} cy={y + 9} r="2.4" style={{ fill: LIGHT }} stroke="none" />
      <circle cx={x + w - 21} cy={y + 9} r="2.4" style={{ fill: LIGHT }} stroke="none" />
      <circle cx={x + w - 12} cy={y + 9} r="2.4" style={{ fill: LIGHT }} stroke="none" />
      {children}
    </g>
  );
}

const DRAWINGS: Record<string, React.ReactNode> = {
  quill: (
    <>
      <path d="M96 150 C130 120 170 168 214 138 S262 128 276 142" style={{ stroke: STROKE }} strokeWidth="1.6" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
      <Feather x={176} y={92} scale={1.05} />
    </>
  ),
  blocks: (
    <>
      <Block cx={160} cy={74} s={30} />
      <Block cx={126} cy={128} s={30} />
      <Block cx={194} cy={128} s={30} />
    </>
  ),
  editor: (
    <>
      <Window x={88} y={34} w={128} h={104} o={0.55} />
      <Window x={118} y={58} w={128} h={104}>
        <g style={{ stroke: LIGHT }} strokeLinecap="round" strokeOpacity="0.8">
          <path d="M134 96 H200" />
          <path d="M134 110 H226" />
          <path d="M134 124 H188" />
          <path d="M134 138 H212" />
        </g>
        <path d="M216 118 V132" style={{ stroke: LIGHT }} strokeWidth="2" strokeLinecap="round" />
      </Window>
    </>
  ),
  terminal: (
    <>
      <g transform="skewY(-12) translate(0 34)">
        <Window x={92} y={44} w={140} h={100} o={0.5} />
        <Window x={112} y={56} w={140} h={100}>
          <path d="M132 112 L146 122 L132 132" style={{ stroke: LIGHT }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M154 134 H178" style={{ stroke: LIGHT }} strokeWidth="2.4" strokeLinecap="round" />
        </Window>
      </g>
    </>
  ),
  server: (
    <>
      <Block cx={160} cy={136} s={44} h={16} />
      <Block cx={160} cy={106} s={44} h={16} />
      <Block cx={160} cy={76} s={44} h={16} />
      <g style={{ fill: LIGHT }}>
        <circle cx={176} cy={90} r="2.2" />
        <circle cx={176} cy={120} r="2.2" />
        <circle cx={176} cy={150} r="2.2" />
      </g>
    </>
  ),
  bot: (
    <g style={{ stroke: STROKE }} strokeWidth="1.4">
      <path d="M160 46 V30" strokeLinecap="round" />
      <circle cx={160} cy={26} r="5" style={{ fill: FILL }} fillOpacity="0.5" />
      <rect x={112} y={46} width={96} height={84} rx="22" style={{ fill: FILL }} fillOpacity="0.3" />
      <rect x={126} y={66} width={68} height={40} rx="12" style={{ fill: FILL }} fillOpacity="0.35" />
      <circle cx={146} cy={86} r="6" style={{ fill: LIGHT }} stroke="none" />
      <circle cx={174} cy={86} r="6" style={{ fill: LIGHT }} stroke="none" />
      <path d="M104 88 H112 M208 88 H216" strokeLinecap="round" />
      <path d="M128 148 H192" strokeOpacity="0.6" strokeLinecap="round" />
    </g>
  ),
};

export const ART_NAMES = Object.keys(DRAWINGS);

/** The picture panel at the top of a home page card: a drawing on a faint grid. */
export function CardArt({ name, id }: { name: string; id: string }) {
  const art = DRAWINGS[name] ?? DRAWINGS.quill;
  return (
    <svg className="card-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`grid-${id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 V20 M0 20 H20" style={{ stroke: STROKE }} strokeOpacity="0.1" strokeWidth="1" strokeDasharray="3 3" fill="none" />
        </pattern>
      </defs>
      <rect width="320" height="180" fill={`url(#grid-${id})`} />
      <g className="card-art-motif">{art}</g>
    </svg>
  );
}

/** Faint drawings around the home page heading. */
export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
      <g opacity="0.32">
        <Feather x={150} y={150} scale={1.9} />
      </g>
      <g opacity="0.22">
        <Block cx={600} cy={-10} s={60} h={40} />
      </g>
      <g opacity="0.26">
        <Block cx={1010} cy={160} s={46} h={46} />
        <Block cx={1090} cy={210} s={30} h={30} />
      </g>
      <g opacity="0.18" transform="translate(40 250) scale(1.1)">
        <Window x={0} y={0} w={120} h={88} />
      </g>
      <g opacity="0.18" transform="translate(1040 20) scale(0.9)">
        <Window x={0} y={0} w={130} h={92} />
      </g>
    </svg>
  );
}
