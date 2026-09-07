import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Trophy, Crown, Target } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

type Search = { subject?: string };

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Testified" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    subject: typeof s.subject === "string" ? s.subject : undefined,
  }),
  component: Leaderboard,
});

type Row = { id: string; full_name: string | null; class: string | null; xp: number; streak: number; correct: number; total: number };

function Leaderboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/leaderboard" });
  const [me, setMe] = useState<string | null>(null);
  const [myClass, setMyClass] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const subjectId = search.subject ?? null;

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      setMe(uid);
      const cls = uid
        ? (await supabase.from("profiles").select("class").eq("id", uid).maybeSingle()).data?.class ?? null
        : null;
      setMyClass(cls);
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
    (async () => {
      setLoading(true);
      // Fetch peers in class
      let profileQ = supabase.from("profiles").select("id, full_name, class, xp, streak").limit(200);
      if (myClass) profileQ = profileQ.eq("class", myClass as any);
      const { data: peers } = await profileQ;
      const peerIds = (peers ?? []).map((p) => p.id);
      if (peerIds.length === 0) { setRows([]); setLoading(false); return; }

      // Attempts scope
      let attemptsQ = supabase.from("quiz_attempts").select("user_id, is_correct, subject_id").in("user_id", peerIds);
      if (subjectId) attemptsQ = attemptsQ.eq("subject_id", subjectId);
      const { data: att } = await attemptsQ;
      const stats = new Map<string, { correct: number; total: number }>();
      for (const a of att ?? []) {
        const s = stats.get((a as any).user_id) ?? { correct: 0, total: 0 };
        s.total += 1; if ((a as any).is_correct) s.correct += 1;
        stats.set((a as any).user_id, s);
      }

      const merged: Row[] = (peers ?? []).map((p) => {
        const s = stats.get(p.id) ?? { correct: 0, total: 0 };
        return { ...p, correct: s.correct, total: s.total };
      });
      // Sort: subject → correct then accuracy; overall → xp
      merged.sort((a, b) => subjectId
        ? (b.correct - a.correct) || (b.total ? b.correct / b.total : 0) - (a.total ? a.correct / a.total : 0)
        : (b.xp - a.xp));
      setRows(merged.slice(0, 100));
      setLoading(false);
    })();
  }, [myClass, subjectId]);

  const currentSubjectName = useMemo(
    () => subjectId ? subjects.find((s) => s.id === subjectId)?.name ?? "Subject" : "Overall",
    [subjectId, subjects],
  );

  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Class {myClass ?? "—"}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {currentSubjectName === "Overall" ? <>Class <span className="gradient-text">leaderboard</span></> : <><span className="gradient-text">{currentSubjectName}</span> leaderboard</>}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {subjectId ? "Ranked by correct answers in this subject." : "Ranked by XP across all activities."}
          </p>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={!subjectId} onClick={() => navigate({ search: {} })}>Overall</FilterChip>
            {subjects.map((s) => (
              <FilterChip key={s.id} active={subjectId === s.id} onClick={() => navigate({ search: { subject: s.id } })}>
                {s.name}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-6 glass rounded-3xl p-3">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No students yet.</div>
          ) : rows.map((r, i) => {
            const acc = r.total ? Math.round((r.correct / r.total) * 100) : 0;
            return (
              <div key={r.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.id === me ? "glass-tint" : ""}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? "bg-amber-500/20 text-amber-400" :
                  i === 1 ? "bg-slate-400/20 text-slate-300" :
                  i === 2 ? "bg-orange-500/20 text-orange-400" :
                  "glass-tint text-primary"
                }`}>{i < 3 ? <Crown className="h-4 w-4" /> : i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.full_name || "Anonymous"} {r.id === me && <span className="text-xs text-primary">· You</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Class {r.class ?? "—"} · {r.streak}d streak</div>
                </div>
                {subjectId ? (
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-sm font-semibold gradient-text"><Target className="h-3.5 w-3.5" /> {r.correct}</div>
                    <div className="text-[10px] text-muted-foreground">{r.total} attempted · {acc}%</div>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 text-sm font-semibold gradient-text"><Trophy className="h-3.5 w-3.5" /> {r.xp}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <Link to="/profile" className="text-xs text-primary hover:underline">View your performance graphs →</Link>
        </div>
      </main>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
        active ? "btn-gradient text-white" : "glass hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
