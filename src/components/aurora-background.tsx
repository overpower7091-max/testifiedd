/** Purely decorative animated depth backdrop, fixed behind all app content. */
export function AuroraBackground() {
  return (
    <div aria-hidden className="aurora-bg">
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="aurora-orb aurora-orb-4" />
      <div className="aurora-orb aurora-orb-5" />
      <div className="aurora-grid" />
      <div className="aurora-vignette" />
    </div>
  );
}
