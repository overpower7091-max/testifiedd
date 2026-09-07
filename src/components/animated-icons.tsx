/**
 * Custom animated SVG icon set for Testified.
 * Each icon is hand-drawn (no generic lucide glyph) and animates via
 * keyframes defined in src/styles.css (`ai-*` classes), all disabled
 * automatically under `prefers-reduced-motion`.
 */

type IconProps = { className?: string };

const base = "h-5 w-5";

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ai-icon ${className ?? base}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Laurel-wrapped rank medal, laurels breathe, star twinkles. */
export function RankIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <g className="ai-sway-l">
        <path d="M7 4c-2.6 1.9-3.3 5.6-1.4 8.3" />
      </g>
      <g className="ai-sway-r">
        <path d="M17 4c2.6 1.9 3.3 5.6 1.4 8.3" />
      </g>
      <circle cx="12" cy="14" r="5.2" />
      <path className="ai-twinkle" d="M12 11.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** XP energy crystal with a rising spark. */
export function XpIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.2l6.2 4.1v9.4L12 20.8 5.8 16.7V7.3z" />
      <path className="ai-pulse-soft" d="M12 7.6l3 2v4.8l-3 2-3-2V9.6z" fill="currentColor" stroke="none" opacity=".55" />
      <path className="ai-rise" d="M12 13.6V10" />
    </Svg>
  );
}

/** Streak flame with a flickering inner core. */
export function StreakIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="ai-flicker" d="M12 2.8c3.4 3 5.4 5.6 5.4 8.7A5.4 5.4 0 0 1 12 17a5.4 5.4 0 0 1-5.4-5.5c0-2 .9-3.7 2.4-5.3" />
      <path className="ai-flicker-fast" d="M12 20.9c2.1 0 3.6-1.3 3.6-3.1 0-1.6-1.2-2.7-2.3-4-.6.9-1.3 1.4-2.2 1.8-1.6.7-2.7 1.2-2.7 2.3 0 1.7 1.5 3 3.6 3z" fill="currentColor" stroke="none" opacity=".75" />
    </Svg>
  );
}

/** Accuracy target with expanding ring and settling arrow. */
export function AccuracyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle className="ai-ring" cx="12" cy="12" r="9" opacity=".5" />
      <circle cx="12" cy="12" r="5.4" />
      <circle className="ai-pulse-soft" cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <path className="ai-arrow" d="M16.6 7.4l4-4M18.2 3.4h2.4v2.4" />
    </Svg>
  );
}

/** Topper crown with a floating sparkle. */
export function CrownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="ai-bob" d="M3.4 8.6l3.3 2.6L12 5l5.3 6.2 3.3-2.6-1.7 9.4H5.1z" />
      <path d="M5.1 20.4h13.8" />
      <circle className="ai-twinkle" cx="20.4" cy="4.6" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Daily quiz: paper with a check that draws itself. */
export function DailyQuizIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 3.6h9.4L19 7.2v13.2H6z" />
      <path d="M15.2 3.6v3.8H19" />
      <path d="M8.8 12.4h3.2M8.8 16h5" opacity=".6" />
      <path className="ai-draw" d="M14.4 12.2l1.7 1.8 3-3.6" />
    </Svg>
  );
}

/** Live broadcast: core dot with two radiating arcs. */
export function LiveIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle className="ai-pulse-soft" cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <g className="ai-wave-1">
        <path d="M7.6 7.6a6.2 6.2 0 0 0 0 8.8M16.4 7.6a6.2 6.2 0 0 1 0 8.8" />
      </g>
      <g className="ai-wave-2">
        <path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8" opacity=".55" />
      </g>
    </Svg>
  );
}

/** AI doubt solver: thinking node with orbiting electron. */
export function AiSolverIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="3.4" />
      <ellipse className="ai-spin-slow" cx="12" cy="12" rx="9" ry="4.2" opacity=".55" style={{ transformOrigin: "12px 12px" }} />
      <circle className="ai-orbit" cx="21" cy="12" r="1.4" fill="currentColor" stroke="none" style={{ transformOrigin: "12px 12px" }} />
    </Svg>
  );
}

/** Leaderboard: three bars that grow in sequence. */
export function LeaderboardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.6 20.4h16.8" />
      <rect className="ai-grow ai-d1" x="4.6" y="12.6" width="4" height="7" rx="1.2" style={{ transformOrigin: "6.6px 19.6px" }} />
      <rect className="ai-grow ai-d2" x="10" y="8.4" width="4" height="11.2" rx="1.2" style={{ transformOrigin: "12px 19.6px" }} />
      <rect className="ai-grow ai-d3" x="15.4" y="5" width="4" height="14.6" rx="1.2" style={{ transformOrigin: "17.4px 19.6px" }} />
    </Svg>
  );
}

/** History: clock face with a sweeping hand. */
export function HistoryIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1L3.4 8.6" />
      <path d="M3.2 4.4v4.4h4.4" />
      <path className="ai-sweep" d="M12 8.2V12l2.8 1.7" style={{ transformOrigin: "12px 12px" }} />
    </Svg>
  );
}
