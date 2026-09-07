import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Trophy, Flame, Target, Sparkles, TrendingUp, BookOpen,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Testified" }] }),
  component: Profile,
});

type Attempt = {
  id: string;
  is_correct: boolean;
  time_seconds: number | null;
  created_at: string;
  session_id: string | null;
  topic_id: string | null;
  subject_id: string | null;
  subject: { id: string; name: string } | null;
};

type Session = {
  key: string;
  subjectId: string | null;
  subjectName: string;
  total: number;
  correct: number;
  startedAt: string;
};

function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) { setLoading(false); return; }
        const uid = userRes.user.id;
        const [{ data: p }, { data: att }, { data: subs }] = await Promise.all([
          supabase.from("profiles")
            .select("full_name, avatar_url, class, xp, streak")
            .eq("id", uid).maybeSingle(),
          supabase.from("quiz_attempts")
            .select("id, is_correct, time_seconds, created_at, session_id, topic_id, subject_id")
            .eq("user_id", uid).order("created_at", { ascending: true }).limit(2000),
          supabase.from("subjects").select("id, name"),
        ]);
        const subMap = new Map((subs ?? []).map((s: any) => [s.id, s.name]));
        const enriched = (att ?? []).map((a: any) => ({
          ...a,
          subject: a.subject_id ? { id: a.subject_id, name: subMap.get(a.subject_id) ?? "Practice" } : null,
        }));
        setProfile(p);
        setAttempts(enriched as any);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sessions = useMemo(() => groupSessions(attempts), [attempts]);
  const perSubject = useMemo(() => {
    const map = new Map<string, { subjectId: string | null; subjectName: string; sessions: Session[] }>();
    for (const s of sessions) {
      const key = s.subjectId ?? "unknown";
      if (!map.has(key)) map.set(key, { subjectId: s.subjectId, subjectName: s.subjectName, sessions: [] });
      map.get(key)!.sessions.push(s);
    }
    return Array.from(map.values());
  }, [sessions]);

  const overall = useMemo(() => sessionsToSeries(sessions), [sessions]);
  const totalCorrect = attempts.filter((a) => a.is_correct).length;
  const acc = attempts.length ? Math.round((totalCorrect / attempts.length) * 100) : 0;
  const bestAcc = sessions.length ? Math.max(...sessions.map((s) => Math.round((s.correct / s.total) * 100))) : 0;

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const initials = (profile.full_name || "S").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        {/* Identity */}
        <section className="glass-strong rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-40" style={{ background: "radial-gradient(closest-side, hsl(217 91% 60% / 0.5), transparent)" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="h-20 w-20 rounded-3xl btn-gradient flex items-center justify-center text-2xl font-semibold text-white shadow-lg shrink-0">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full rounded-3xl object-cover" /> : initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Profile</div>
              <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight truncate">{profile.full_name || "Student"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Class {profile.class ?? "—"} · WBBSE</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:min-w-[420px]">
              <MiniStat icon={<Sparkles className="h-3.5 w-3.5" />} label="XP" value={String(profile.xp ?? 0)} />
              <MiniStat icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={`${profile.streak ?? 0}d`} />
              <MiniStat icon={<Target className="h-3.5 w-3.5" />} label="Accuracy" value={attempts.length ? `${acc}%` : "—"} />
              <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} label="Best" value={sessions.length ? `${bestAcc}%` : "—"} />
            </div>
          </div>
        </section>

        {/* Overall trend */}
        <section className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Overall</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Accuracy <span className="gradient-text">trend</span></h2>
              <p className="mt-1 text-xs text-muted-foreground">Across every practice session, most recent on the right.</p>
            </div>
            <Link to="/leaderboard" className="hidden sm:inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary">
              <Trophy className="h-3.5 w-3.5 text-primary" /> Leaderboard
            </Link>
          </div>
          <div className="mt-5 h-72">
            {overall.length < 2 ? (
              <EmptyChart />
            ) : (
              <AreaTrend data={overall} gradientId="gOverall" from="hsl(221 83% 60%)" to="hsl(199 89% 60%)" />
            )}
          </div>
        </section>

        {/* Per-subject */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Subject-wise performance</h2>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> accuracy % per quiz</div>
          </div>
          {perSubject.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              No quizzes yet. Take a practice quiz to see your subject-wise trend.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {perSubject.map((sub, i) => {
                const series = sessionsToSeries(sub.sessions);
                const palette = PALETTES[i % PALETTES.length];
                const avg = sub.sessions.length
                  ? Math.round(sub.sessions.reduce((s, x) => s + (x.correct / x.total) * 100, 0) / sub.sessions.length)
                  : 0;
                return (
                  <div key={sub.subjectId ?? String(i)} className="glass rounded-3xl p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold truncate">{sub.subjectName}</div>
                        <div className="text-[11px] text-muted-foreground">{sub.sessions.length} quiz{sub.sessions.length === 1 ? "" : "zes"} · avg {avg}%</div>
                      </div>
                      <div className="text-xs font-semibold gradient-text">{avg}%</div>
                    </div>
                    <div className="mt-3 h-44">
                      {series.length < 2 ? (
                        <EmptyChart small />
                      ) : (
                        <AreaTrend data={series} gradientId={`g-${i}`} from={palette.from} to={palette.to} compact />
                      )}
                    </div>
                    {sub.subjectId && (
                      <div className="mt-3 flex justify-end">
                        <Link to="/leaderboard" search={{ subject: sub.subjectId } as any} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> Subject leaderboard
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* --------------------------------- chart --------------------------------- */

function AreaTrend({ data, gradientId, from, to, compact }: {
  data: { label: string; accuracy: number; date: string }[];
  gradientId: string; from: string; to: string; compact?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity={0.55} />
            <stop offset="100%" stopColor={to} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 4" stroke="hsl(220 15% 30% / 0.25)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 10% 65%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" hide={compact} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: "hsl(220 10% 65%)" }} axisLine={false} tickLine={false} width={26} />
        <Tooltip
          cursor={{ stroke: "hsl(217 91% 60% / 0.4)", strokeWidth: 1 }}
          contentStyle={{ background: "hsl(222 30% 12% / 0.95)", border: "1px solid hsl(220 15% 25%)", borderRadius: 12, fontSize: 12, color: "white" }}
          labelStyle={{ color: "hsl(220 10% 70%)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
          formatter={(v: any) => [`${v}%`, "Accuracy"]}
        />
        <Area type="monotone" dataKey="accuracy" stroke={`url(#${gradientId}-stroke)`} strokeWidth={2.5} fill={`url(#${gradientId})`} activeDot={{ r: 5, stroke: from, strokeWidth: 2, fill: "white" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ small }: { small?: boolean }) {
  return (
    <div className={`h-full w-full flex items-center justify-center text-xs text-muted-foreground rounded-2xl glass-tint ${small ? "" : ""}`}>
      Take at least 2 quizzes to see a trend.
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

function groupSessions(rows: Attempt[]): Session[] {
  const map = new Map<string, Session>();
  for (const r of rows) {
    const subjectName = r.subject?.name ?? "Practice";
    const subjectId = r.subject?.id ?? r.subject_id ?? null;
    const key = r.session_id ? String(r.session_id) : `legacy:${r.topic_id ?? "x"}:${r.created_at.slice(0, 16)}`;
    const ex = map.get(key);
    if (ex) {
      ex.total += 1;
      ex.correct += r.is_correct ? 1 : 0;
      if (r.created_at < ex.startedAt) ex.startedAt = r.created_at;
    } else {
      map.set(key, { key, subjectId, subjectName, total: 1, correct: r.is_correct ? 1 : 0, startedAt: r.created_at });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
}

function sessionsToSeries(sessions: Session[]) {
  return sessions.map((s, i) => {
    const d = new Date(s.startedAt);
    return {
      label: `#${i + 1}`,
      date: d.toLocaleDateString(),
      accuracy: Math.round((s.correct / s.total) * 100),
    };
  });
}

const PALETTES = [
  { from: "hsl(221 83% 60%)", to: "hsl(199 89% 65%)" },
  { from: "hsl(160 84% 45%)", to: "hsl(180 80% 55%)" },
  { from: "hsl(280 80% 65%)", to: "hsl(320 80% 65%)" },
  { from: "hsl(30 90% 60%)", to: "hsl(45 95% 60%)" },
];

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">{icon} {label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
