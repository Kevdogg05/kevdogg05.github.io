// The SnS Palace logo: a fairy-tale castle with a crown on top. The crown
// wobbles, the flags wave, the windows twinkle and sparkles pop around the
// crown. Pure CSS animation (see globals.css), and it holds still for anyone
// who prefers reduced motion. src/app/icon.svg is a still copy for the tab.

const OUTLINE = "#3d1a55";
const WALL = "#fff1fb";
const ROOF = "#2ee6ff";
const GOLD = "#ffd60a";

/** A four-point sparkle centred on the origin. */
const SPARKLE = "M0-3L.8-.8L3 0L.8.8L0 3L-.8.8L-3 0L-.8-.8Z";

/** A small arched window whose bottom-left corner is (x, y). */
const windowPath = (x: number, y: number) => `M${x} ${y}v-3a1.5 1.5 0 0 1 3 0v3z`;

export function CastleLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <g stroke={OUTLINE} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        {/* Flag poles, and flags waving outwards from them */}
        <path d="M13 18V6.5M51 18V6.5" fill="none" />
        <g strokeWidth="1.4">
          <path className="castle-flag" style={{ transformOrigin: "100% 50%" }} d="M13 7L4 10.25L13 13.5Z" fill={GOLD} />
          <path className="castle-flag" style={{ animationDelay: "-0.6s" }} d="M51 7L60 10.25L51 13.5Z" fill="#7cff4f" />
        </g>

        {/* Side towers with pointy roofs */}
        <rect x="7" y="30" width="12" height="26" fill={WALL} />
        <rect x="45" y="30" width="12" height="26" fill={WALL} />
        <path d="M5 31L13 17L21 31Z" fill={ROOF} />
        <path d="M43 31L51 17L59 31Z" fill={ROOF} />

        {/* The keep, with battlements */}
        <path d="M19 56V22H23V25H26.3V22H30.3V25H33.7V22H37.7V25H41V22H45V56Z" fill={WALL} />
        <path d="M27.5 56V48.5a4.5 4.5 0 0 1 9 0V56Z" fill={OUTLINE} />
        <path d="M4 56H60" fill="none" />

        {/* Lit windows, twinkling out of step */}
        <g strokeWidth="1.5" fill={GOLD}>
          <path className="castle-window" d={windowPath(11.5, 44)} />
          <path className="castle-window" style={{ animationDelay: "-1.1s" }} d={windowPath(49.5, 44)} />
          <path className="castle-window" style={{ animationDelay: "-2.2s" }} d={windowPath(23, 36)} />
          <path className="castle-window" style={{ animationDelay: "-0.5s" }} d={windowPath(38, 36)} />
        </g>

        {/* The crown, floating just above the battlements */}
        <g className="castle-crown">
          <path d="M23.5 19V10.5L28 14L32 6.5L36 14L40.5 10.5V19Z" fill={GOLD} />
          <path d="M23.5 16.5H40.5" fill="none" strokeWidth="1.5" />
          <g strokeWidth="1.2">
            <circle cx="32" cy="12.6" r="1.6" fill="#ff5fd2" />
            <circle cx="23.5" cy="9.6" r="1.4" fill={GOLD} />
            <circle cx="32" cy="5.6" r="1.4" fill={GOLD} />
            <circle cx="40.5" cy="9.6" r="1.4" fill={GOLD} />
          </g>
        </g>
      </g>

      {/* Sparkles around the crown */}
      <g fill="#ffffff">
        <g transform="translate(18.5 4.5) scale(1.2)">
          <path className="castle-sparkle" d={SPARKLE} />
        </g>
        <g transform="translate(45.5 4) scale(1.05)">
          <path className="castle-sparkle" style={{ animationDelay: "-0.8s" }} d={SPARKLE} />
        </g>
        <g transform="translate(43.5 17.5) scale(0.75)">
          <path className="castle-sparkle" style={{ animationDelay: "-1.5s" }} d={SPARKLE} />
        </g>
      </g>
    </svg>
  );
}
