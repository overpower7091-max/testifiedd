import { useEffect, useMemo, useState } from "react";
import { Crown, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PodiumStudent = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  correct: number;
  total: number;
};

type Stage = "waiting" | "bronze" | "silver" | "gold" | "celebrate" | "complete";

const CONFETTI = Array.from({ length: 30 }, (_, index) => ({
  left: `${4 + ((index * 37) % 92)}%`,
  delay: `${(index % 10) * 70}ms`,
  duration: `${1.7 + (index % 5) * 0.18}s`,
  turn: `${(index % 2 ? 1 : -1) * (140 + (index % 4) * 45)}deg`,
}));

const SPARKS = Array.from({ length: 12 }, (_, index) => ({
  angle: `${index * 30}deg`,
  delay: `${(index % 3) * 90}ms`,
}));

export function LeaderboardPodium({
  students,
  subjectMode,
  ceremonyKey,
  onComplete,
}: {
  students: PodiumStudent[];
  subjectMode: boolean;
  ceremonyKey: string;
  onComplete: (complete: boolean) => void;
}) {
  const [stage, setStage] = useState<Stage>("waiting");
  const [run, setRun] = useState(0);
  const visible = useMemo(() => ({
    bronze: ["bronze", "silver", "gold", "celebrate", "complete"].includes(stage),
    silver: ["silver", "gold", "celebrate", "complete"].includes(stage),
    gold: ["gold", "celebrate", "complete"].includes(stage),
    celebrating: stage === "celebrate",
  }), [stage]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setStage("complete");
      onComplete(true);
      return;
    }

    setStage("waiting");
    onComplete(false);
    const timers = [
      window.setTimeout(() => setStage("bronze"), 260),
      window.setTimeout(() => setStage("silver"), 1_180),
      window.setTimeout(() => setStage("gold"), 2_100),
      window.setTimeout(() => setStage("celebrate"), 3_050),
      window.setTimeout(() => { setStage("complete"); onComplete(true); }, 4_650),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [ceremonyKey, run, onComplete]);

  const finish = () => {
    setStage("complete");
    onComplete(true);
  };

  const replay = () => {
    onComplete(false);
    setRun((value) => value + 1);
  };

  return (
    <section className="podium-stage glass-strong relative mt-6 overflow-hidden rounded-3xl" aria-label="Top three performers">
      <div className="absolute right-3 top-3 z-30 flex gap-2">
        {stage !== "complete" && (
          <Button variant="ghost" size="sm" onClick={finish} className="rounded-full text-muted-foreground">
            Skip
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={replay} className="rounded-full text-muted-foreground" aria-label="Replay podium celebration">
          <RotateCcw /> <span className="hidden sm:inline">Replay</span>
        </Button>
      </div>

      <div className="relative z-10 px-4 pb-6 pt-14 text-center sm:px-8 sm:pt-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-warning">Top performers</div>
        <h2 className="mt-1 text-xl font-semibold">Class champions</h2>
        <div className="podium-field mx-auto mt-5 grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4">
          <PodiumPlace rank={2} student={students[1]} visible={visible.silver} subjectMode={subjectMode} />
          <PodiumPlace rank={1} student={students[0]} visible={visible.gold} subjectMode={subjectMode} celebrating={visible.celebrating} />
          <PodiumPlace rank={3} student={students[2]} visible={visible.bronze} subjectMode={subjectMode} />
        </div>
      </div>

      {visible.celebrating && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
          {CONFETTI.map((piece, index) => (
            <i
              key={index}
              className={cn("podium-confetti", `podium-confetti-${index % 5}`)}
              style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, "--confetti-turn": piece.turn } as React.CSSProperties}
            />
          ))}
          <div className="podium-firework podium-firework-left">
            {SPARKS.map((spark, index) => <i key={index} style={{ "--spark-angle": spark.angle, animationDelay: spark.delay } as React.CSSProperties} />)}
          </div>
          <div className="podium-firework podium-firework-right">
            {SPARKS.map((spark, index) => <i key={index} style={{ "--spark-angle": spark.angle, animationDelay: spark.delay } as React.CSSProperties} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function PodiumPlace({
  rank,
  student,
  visible,
  subjectMode,
  celebrating = false,
}: {
  rank: 1 | 2 | 3;
  student?: PodiumStudent;
  visible: boolean;
  subjectMode: boolean;
  celebrating?: boolean;
}) {
  const label = rank === 1 ? "Gold" : rank === 2 ? "Silver" : "Bronze";
  const initials = student?.full_name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  const accuracy = student?.total ? Math.round((student.correct / student.total) * 100) : 0;
  const score = subjectMode ? `${student?.correct ?? 0} correct · ${accuracy}%` : `${student?.xp ?? 0} XP`;

  return (
    <div className={cn("podium-place", `podium-place-${rank}`, visible && "is-visible", celebrating && "is-celebrating")}>
      <div className="podium-winner">
        {rank === 1 && <Crown className="podium-crown mx-auto text-warning" aria-hidden="true" />}
        <div className={cn("podium-avatar mx-auto", `podium-avatar-${rank}`)}>
          {student?.avatar_url ? <img src={student.avatar_url} alt="" /> : <span>{initials}</span>}
        </div>
        <div className="mt-2 min-w-0">
          <div className="truncate text-xs font-semibold sm:text-sm">{student?.full_name || "Open place"}</div>
          <div className="mt-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">{student ? score : "Be the first"}</div>
        </div>
        <Trophy className={cn("podium-trophy mx-auto mt-2", `podium-trophy-${rank}`)} aria-label={`${label} trophy`} />
      </div>
      <div className={cn("podium-block", `podium-block-${rank}`)}>
        <div className="podium-rank">{rank}</div>
        <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[10px]">{label}</div>
      </div>
      {rank === 1 && celebrating && <Sparkles className="podium-champion-spark text-warning" aria-hidden="true" />}
    </div>
  );
}