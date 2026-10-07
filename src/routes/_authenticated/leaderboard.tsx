import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trophy, Target, Radio } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { LeaderboardPodium } from "@/components/leaderboard-podium";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Search = { subject?: string; view?: "xp" };

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [
    { title: "Class Leaderboard — Testified" },
    { name: "description", content: "Celebrate the daily quiz champions and compare class rankings on Testified." },
    { property: "og:title", content: "Class Leaderboard — Testified" },
    { property: "og:description", content: "Celebrate the daily quiz champions and compare class rankings on Testified." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    subject: typeof s.subject === "string" ? s.subject : undefined,
    view: s.view === "xp" ? "xp" : undefined,
  }),
  component: Leaderboard,
});

type Row = {
  id: string; full_name: string | null; avatar_url: string | null;
  primary: string; secondary: string; scoreText: string;
};

function Leaderboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/leaderboard" });
  const [me, setMe] = useState<string | null>(null);
  const [myClass, setMyClass] = useState<string | null>(null);
  const [classReady, setClassReady] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [dailyInfo, setDailyInfo] = useState<{ subject: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ceremonyComplete, setCeremonyComplete] = useState(false);

  const subjectId = search.subject ?? null;
  const mode: "daily" | "xp" | "subject" = subjectId ? "subject" : search.view === "xp" ? "xp" : "daily";

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id ?? null;
      setMe(uid);
      const cls = uid
        ? (await supabase.from("profiles").select("class").eq("id", uid).maybeSingle()).data?.class ?? null
        : null;
      setMyClass(cls);
      setClassReady(true);
      if (cls) {
        const { data: c } = await supabase.from("classes").select("id").eq("level", cls).maybeSingle();
        if (c) {
          const { data: subs } = await supabase.from("subjects").select("id, name").eq("class_id", c.id).order("position");
          setSubjects(subs ?? []);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!classReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result: Row[] = [];

      if (mode === "daily") {
        setDailyInfo(null);
        if (myClass) {
          const { data: quiz } = await supabase.from("live_quizzes")
            .select("id, ended_at, scheduled_at, subject:subjects(name)")
            .eq("class_level", myClass as any)
            .eq("status", "ended")
            .order("ended_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (quiz) {
            const subj = Array.isArray(quiz.subject) ? quiz.subject[0]?.name : (quiz.subject as any)?.name;
            setDailyInfo({ subject: subj || "Daily Quiz", date: new Date(quiz.ended_at ?? quiz.scheduled_at).toLocaleDateString() });
            const { data: parts } = await supabase.from("live_quiz_participants")
              .select("user_id, score, correct_count, answered_count, total_time_ms")
              .eq("live_quiz_id", quiz.id)
              .gt("answered_count", 0)
              .order("score", { ascending: false })
              .order("correct_count", { ascending: false })
              .order("total_time_ms", { ascending: true })
              .limit(100);
            const ids = (parts ?? []).map((p) => p.user_id);
            const { data: profs } = ids.length
              ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
              : { data: [] as any[] };
            const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
            for (const p of parts ?? []) {
              const prof: any = byId.get(p.user_id);
              result.push({
                id: p.user_id, full_name: prof?.full_name ?? null, avatar_url: prof?.avatar_url ?? null,
                primary: `${p.score}`,
                secondary: `${p.correct_count}/${p.answered_count} correct · ${Math.round((p.total_time_ms ?? 0) / 1000)}s`,
                scoreText: `${p.score} pts · ${p.correct_count} correct`,
              });
            }
          }
        }
      } else {
        let profileQ = supabase.from("profiles").select("id, full_name, avatar_url, class, xp, streak").limit(200);
        if (myClass) profileQ = profileQ.eq("class", myClass as any);
        const { data: peers } = await profileQ;
        const peerIds = (peers ?? []).map((p) => p.id);
        if (mode === "xp") {
          [...(peers ?? [])].sort((a, b) => b.xp - a.xp).forEach((p) => result.push({
            id: p.id, full_name: p.full_name, avatar_url: p.avatar_url,
            primary: `${p.xp}`, secondary: `Class ${p.class ?? "—"} · ${p.streak}d streak`, scoreText: `${p.xp} XP`,
          }));
        } else if (peerIds.length) {
          const { data: att } = await supabase.from("quiz_attempts").select("user_id, is_correct").in("user_id", peerIds).eq("subject_id", subjectId!);
          const stats = new Map<string, { correct: number; total: number }>();
          for (const a of att ?? []) {
            const s = stats.get(a.user_id) ?? { correct: 0, total: 0 };
            s.total += 1; if (a.is_correct) s.correct += 1;
            stats.set(a.user_id, s);
          }
          (peers ?? []).map((p) => ({ p, s: stats.get(p.id) ?? { correct: 0, total: 0 } }))
            .sort((a, b) => (b.s.correct - a.s.correct) || ((b.s.total ? b.s.correct / b.s.total : 0) - (a.s.total ? a.s.correct / a.s.total : 0)))
            .forEach(({ p, s }) => {
              const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
              result.push({
                id: p.id, full_name: p.full_name, avatar_url: p.avatar_url,
                primary: `${s.correct}`, secondary: `${s.total} attempted · ${acc}%`, scoreText: `${s.correct} correct · ${acc}%`,
              });
            });
        }
      }
      if (cancelled) return;
      setRows(result.slice(0, 100));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classReady, myClass, subjectId, mode]);

  const currentSubjectName = useMemo(
    () => subjectId ? subjects.find((s) => s.id === subjectId)?.name ?? "Subject" : null,
    [subjectId, subjects],
  );
  const setComplete = useCallback((complete: boolean) => setCeremonyComplete(complete), []);

  const heading = mode === "daily"
    ? <>Daily quiz <span className="gradient-text">champions</span></>
    : mode === "xp" ? <>All-time <span className="gradient-text">XP</span></>
    : <><span className="gradient-text">{currentSubjectName}</span> leaderboard</>;
  const blurb = mode === "daily"
    ? dailyInfo ? `${dailyInfo.subject} · ${dailyInfo.date} — everyone gets the same questions at the same time.` : "Ranked by the latest daily live quiz — same questions, same time, fair for everyone."
    : mode === "xp" ? "Ranked by XP across all activities." : "Ranked by correct answers in this subject.";

  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Class {myClass ?? "—"}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={mode === "daily"} onClick={() => navigate({ search: {} })}>Daily Quiz</FilterChip>
            <FilterChip active={mode === "xp"} onClick={() => navigate({ search: { view: "xp" } })}>All-time XP</FilterChip>
            {subjects.map((s) => (
              <FilterChip key={s.id} active={subjectId === s.id} onClick={() => navigate({ search: { subject: s.id } })}>
                {s.name}
              </FilterChip>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 glass rounded-3xl py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="mt-6 glass rounded-3xl py-16 px-6 text-center">
            <Radio className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-medium">{mode === "daily" ? "No daily quiz results yet" : "No students yet."}</p>
            {mode === "daily" && (
              <Link to="/live" className="mt-4 inline-flex btn-gradient rounded-full px-5 py-2 text-sm font-medium">Join the next live quiz</Link>
            )}
          </div>
        ) : (
          <>
            <LeaderboardPodium
              students={rows.slice(0, 3).map((r) => ({ id: r.id, full_name: r.full_name, avatar_url: r.avatar_url, scoreText: r.scoreText }))}
              title={mode === "daily" ? "Daily quiz champions" : "Class champions"}
              ceremonyKey={`${mode}:${subjectId ?? ""}:${rows.map((row) => row.id).join(":")}`}
              onComplete={setComplete}
            />
            <div className={`leaderboard-rest mt-6 glass rounded-3xl p-3 ${ceremonyComplete ? "is-visible" : ""}`} aria-hidden={!ceremonyComplete}>
              <div className="mb-2 flex items-center justify-between px-3 pt-2">
                <h2 className="text-sm font-semibold">More rankings</h2>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">4–100</span>
              </div>
              {rows.length <= 3 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">More places are waiting to be claimed.</div>
              ) : rows.slice(3).map((r, i) => (
                <div key={r.id} className={`leaderboard-row flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.id === me ? "glass-tint" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                  <div className="glass-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary">{i + 4}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.full_name || "Anonymous"} {r.id === me && <span className="text-xs text-primary">· You</span>}</div>
                    <div className="text-[11px] text-muted-foreground">{r.secondary}</div>
                  </div>
                  <div className="gradient-text inline-flex items-center gap-1 text-sm font-semibold">
                    {mode === "subject" ? <Target className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />} {r.primary}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && rows.length > 0 && !ceremonyComplete && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setCeremonyComplete(true)}>Show all rankings</Button>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <Link to="/profile" className="text-xs text-primary hover:underline">View your performance graphs →</Link>
        </div>
      </main>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="sm"
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
        active ? "btn-gradient text-foreground" : "glass hover:text-primary"
      }`}
    >
      {children}
    </Button>
  );
}
