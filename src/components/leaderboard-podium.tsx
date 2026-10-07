import { useEffect, useMemo, useState } from "react";
import { Crown, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PodiumStudent = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  scoreText: string;
};

type Stage = "waiting" | "stage" | "bronze" | "silver" | "gold" | "celebrate" | "complete";
const ORDER: Stage[] = ["waiting", "stage", "bronze", "silver", "gold", "celebrate", "complete"];

const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  left: `${2 + ((i * 37) % 96)}%`,
  delay: `${(i % 11) * 60}ms`,
  duration: `${1.9 + (i % 5) * 0.2}s`,
  turn: `${(i % 2 ? 1 : -1) * (180 + (i % 4) * 60)}deg`,
  drift: `${((i % 7) - 3) * 14}px`,
}));
const SPARKS = Array.from({ length: 12 }, (_, i) => ({ angle: `${i * 30}deg`, delay: `${(i % 3) * 80}ms` }));

export function LeaderboardPodium({
  students,
  title = "Class champions",
  ceremonyKey,
  onComplete,
}: {
  students: PodiumStudent[];
  title?: string;
  ceremonyKey: string;
  onComplete: (complete: boolean) => void;
}) {
  const [stage, setStage] = useState<Stage>("waiting");
  const [run, setRun] = useState(0);
  const at = (s: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(s);
  const visible = useMemo(() => ({
    stage: at("stage"), bronze: at("bronze"), silver: at("silver"), gold: at("gold"),
    celebrating: stage === "celebrate", done: stage === "complete",
  }), [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage("complete"); onComplete(true); return;
    }
    setStage("waiting");
    onComplete(false);
    const timers = [
      window.setTimeout(() => setStage("stage"), 80),
      window.setTimeout(() => setStage("bronze"), 900),
      window.setTimeout(() => setStage("silver"), 1_700),
      window.setTimeout(() => setStage("gold"), 2_500),
      window.setTimeout(() => setStage("celebrate"), 3_400),
      window.setTimeout(() => { setStage("complete"); onComplete(true); }, 5_600),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [ceremonyKey, run, onComplete]);

  return (
    <section className="podium-stage glass-strong relative mt-6 overflow-hidden rounded-3xl" aria-label="Top three performers">
      <div className="podium-spotlight" aria-hidden="true" />
      <div className="absolute right-3 top-3 z-30 flex gap-2">
        {stage !== "complete" && (
          <Button variant="ghost" size="sm" onClick={() => { setStage("complete"); onComplete(true); }} className="rounded-full text-muted-foreground">Skip</Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { onComplete(false); setRun((v) => v + 1); }} className="rounded-full text-muted-foreground" aria-label="Replay podium celebration">
          <RotateCcw /> <span className="hidden sm:inline">Replay</span>
        </Button>
      </div>

      <div className="relative z-10 px-3 pb-6 pt-14 text-center sm:px-8 sm:pt-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-warning">Top performers</div>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        <div className={cn("podium-field mx-auto mt-6 grid max-w-2xl grid-cols-3 items-end gap-1.5 sm:gap-3", visible.stage && "is-built")}>
          <PodiumPlace rank={2} student={students[1]} visible={visible.silver} celebrating={visible.celebrating} />
          <PodiumPlace rank={1} student={students[0]} visible={visible.gold} celebrating={visible.celebrating} />
          <PodiumPlace rank={3} student={students[2]} visible={visible.bronze} celebrating={visible.celebrating} />
        </div>
      </div>

      {visible.celebrating && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <i key={i} className={cn("podium-confetti", `podium-confetti-${i % 5}`)}
              style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, "--confetti-turn": p.turn, "--confetti-drift": p.drift } as React.CSSProperties} />
          ))}
          {["left", "right", "center"].map((side) => (
            <div key={side} className={`podium-firework podium-firework-${side}`}>
              {SPARKS.map((s, i) => <i key={i} style={{ "--spark-angle": s.angle, animationDelay: s.delay } as React.CSSProperties} />)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PodiumPlace({ rank, student, visible, celebrating }: {
  rank: 1 | 2 | 3; student?: PodiumStudent; visible: boolean; celebrating: boolean;
}) {
  const label = rank === 1 ? "Gold" : rank === 2 ? "Silver" : "Bronze";
  const initials = student?.full_name?.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

  return (
    <div className={cn("podium-place", `podium-place-${rank}`, visible && "is-visible", celebrating && student && "is-celebrating")}>
      <div className="podium-winner">
        {rank === 1 && <Crown className="podium-crown mx-auto" aria-hidden="true" />}
        <div className={cn("podium-avatar mx-auto", `podium-avatar-${rank}`, !student && "is-empty")}>
          {student?.avatar_url ? <img src={student.avatar_url} alt="" /> : <span>{student ? initials : "?"}</span>}
          <Trophy className={cn("podium-cup", `podium-trophy-${rank}`)} aria-label={`${label} trophy`} />
        </div>
        <div className="podium-tag mx-auto mt-2 min-w-0">
          <div className="truncate text-xs font-semibold sm:text-sm">{student?.full_name || `Claim #${rank}!`}</div>
          <div className="mt-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">{student ? student.scoreText : "Open place"}</div>
        </div>
      </div>
      <div className={cn("podium-block", `podium-block-${rank}`)}>
        <div className="podium-rank">{rank}</div>
        <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[10px]">{label}</div>
      </div>
    </div>
  );
}
