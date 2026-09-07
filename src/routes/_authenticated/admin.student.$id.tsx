import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, Trophy, Flame, Sparkles, Target, Clock, User, TrendingUp, Radio } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";
import { AreaTrend, EmptyChart, groupSessions, sessionsToSeries, PALETTES } from "@/components/perf-charts";

export const Route = createFileRoute("/_authenticated/admin/student/$id")({
  head: () => ({ meta: [{ title: "Student profile — Admin" }] }),
  component: StudentProfile,
});

type Profile = {
  id: string; full_name: string | null; class: string | null; xp: number;
  streak: number; is_banned: boolean; banned_reason: string | null;
  banned_at: string | null; created_at: string; avatar_url: string | null;
};

type Attempt = { id: string; is_correct: boolean; time_seconds: number; created_at: string; subject_id: string | null; session_id: string | null; topic_id: string | null };
type LiveRow = { live_quiz_id: string; correct_count: number; answered_count: number; score: number; rank: number | null; total_time_ms: number; finished_at: string | null; quiz: { scheduled_at: string; questions_total: number; subject_id: string | null } | null };

function StudentProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const load = async () => {
    const [{ data: p }, { data: a }, { data: subjects }, { data: lp }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("quiz_attempts").select("id, is_correct, time_seconds, created_at, subject_id, session_id, topic_id").eq("user_id", id).order("created_at", { ascending: false }).limit(2000),
      supabase.from("subjects").select("id, name"),
      supabase.from("live_quiz_participants")
        .select("live_quiz_id, correct_count, answered_count, score, rank, total_time_ms, finished_at, live_quizzes(scheduled_at, questions_total, subject_id)")
        .eq("user_id", id)
        .limit(200),
    ]);
    setProfile(p as any);
    setAttempts((a ?? []) as any);
    setLive(((lp ?? []) as any[]).map((r) => ({ ...r, quiz: r.live_quizzes ?? null })).filter((r) => r.quiz)
      .sort((x, y) => (x.quiz.scheduled_at < y.quiz.scheduled_at ? -1 : 1)) as any);
    const map: Record<string, string> = {};
    (subjects ?? []).forEach((s: any) => (map[s.id] = s.name));
    setSubjectMap(map);
    setLoading(false);
  };


  useEffect(() => { load(); }, [id]);

  const stats = useMemo(() => {
    const total = attempts.length;
    const correct = attempts.filter((a) => a.is_correct).length;
    const timeMin = Math.round(attempts.reduce((s, a) => s + (a.time_seconds || 0), 0) / 60);
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    // Last 14 days daily counts
    const days: { day: string; count: number; correct: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const day = attempts.filter((a) => a.created_at.slice(0, 10) === key);
      days.push({ day: key.slice(5), count: day.length, correct: day.filter((x) => x.is_correct).length });
    }
    // Subject breakdown
    const bySubject: Record<string, { total: number; correct: number }> = {};
    attempts.forEach((a) => {
      const key = a.subject_id ?? "other";
      bySubject[key] ??= { total: 0, correct: 0 };
      bySubject[key].total++;
      if (a.is_correct) bySubject[key].correct++;
    });
    return { total, correct, timeMin, accuracy, days, bySubject };
  }, [attempts]);

  const sessions = useMemo(
    () => groupSessions([...attempts].reverse(), (sid) => (sid ? subjectMap[sid] ?? "Practice" : "Practice")),
    [attempts, subjectMap],
  );
  const overallSeries = useMemo(() => sessionsToSeries(sessions), [sessions]);
  const perSubject = useMemo(() => {
    const map = new Map<string, { subjectId: string | null; subjectName: string; sessions: typeof sessions }>();
    for (const s of sessions) {
      const key = s.subjectId ?? "unknown";
      if (!map.has(key)) map.set(key, { subjectId: s.subjectId, subjectName: s.subjectName, sessions: [] });
      map.get(key)!.sessions.push(s);
    }
    return Array.from(map.values());
  }, [sessions]);
  const liveSeries = useMemo(
    () => live.map((r, i) => ({
      label: `#${i + 1}`,
      date: new Date(r.quiz!.scheduled_at).toLocaleDateString(),
      accuracy: r.quiz!.questions_total ? Math.round((r.correct_count / r.quiz!.questions_total) * 100) : 0,
    })),
    [live],
  );
  const liveAvg = liveSeries.length ? Math.round(liveSeries.reduce((s, x) => s + x.accuracy, 0) / liveSeries.length) : 0;
  const bestRank = live.reduce<number | null>((b, r) => (r.rank && (b === null || r.rank < b) ? r.rank : b), null);



  const toggleBan = async () => {
    if (!profile) return;
    setSaving(true);
    const nextBan = !profile.is_banned;
    const { error } = await supabase.from("profiles").update({
      is_banned: nextBan,
      banned_reason: nextBan ? (reason || "Violation of platform rules") : null,
      banned_at: nextBan ? new Date().toISOString() : null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(nextBan ? "Student suspended" : "Access restored");
    setReason("");
    load();
  };

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const maxDay = Math.max(1, ...stats.days.map((d) => d.count));

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass-tint text-primary shrink-0">
              {profile.avatar_url ? <img src={profile.avatar_url} className="h-16 w-16 rounded-2xl object-cover" alt="" /> : <User className="h-8 w-8" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{profile.full_name || "Unnamed"}</h1>
                {profile.is_banned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium">
                    <ShieldAlert className="h-3 w-3" /> Suspended
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Class {profile.class ?? "—"} · Joined {new Date(profile.created_at).toLocaleDateString()}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(profile.id)}
                className="mt-1 text-[10px] text-muted-foreground/70 font-mono hover:text-primary"
                title="Copy user id"
              >{profile.id.slice(0, 8)}…</button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat icon={<Sparkles className="h-4 w-4" />} label="XP" value={String(profile.xp)} />
            <Stat icon={<Flame className="h-4 w-4" />} label="Streak" value={`${profile.streak}d`} />
            <Stat icon={<Target className="h-4 w-4" />} label="Accuracy" value={`${stats.accuracy}%`} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Time" value={`${stats.timeMin}m`} />
          </div>
        </div>

        {/* Ban toggle */}
        <div className={`rounded-3xl p-6 ${profile.is_banned ? "glass-strong" : "glass"}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {profile.is_banned ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
                {profile.is_banned ? "Account suspended" : "Account active"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.is_banned
                  ? `Suspended ${profile.banned_at ? new Date(profile.banned_at).toLocaleString() : ""}${profile.banned_reason ? ` · ${profile.banned_reason}` : ""}`
                  : "Restrict access if this student is violating platform rules."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[240px] justify-end">
              {!profile.is_banned && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="glass rounded-full px-4 py-2 text-sm bg-transparent outline-none flex-1 max-w-xs placeholder:text-muted-foreground"
                />
              )}
              <button
                onClick={toggleBan}
                disabled={saving}
                className={`rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 ${
                  profile.is_banned ? "btn-gradient" : "bg-destructive text-destructive-foreground hover:opacity-90"
                }`}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {profile.is_banned ? "Restore access" : "Suspend student"}
              </button>
            </div>
          </div>
        </div>

        {/* Performance graph */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> 14-day activity</h2>
            <span className="text-xs text-muted-foreground">{stats.total} attempts total · {stats.correct} correct</span>
          </div>
          <div className="mt-6 flex items-end gap-1.5 h-32">
            {stats.days.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end h-full">
                  <div className="w-full rounded-t-md btn-gradient" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? "4px" : "1px", opacity: d.count ? 1 : 0.15 }} title={`${d.count} attempts (${d.correct} correct)`} />
                </div>
                <div className="text-[9px] text-muted-foreground">{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject breakdown */}
        <div className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold">By subject</h2>
          {Object.keys(stats.bySubject).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No practice attempts yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {Object.entries(stats.bySubject).map(([sid, v]) => {
                const acc = Math.round((v.correct / v.total) * 100);
                return (
                  <div key={sid} className="glass-tint rounded-2xl p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{subjectMap[sid] ?? "Other"}</span>
                      <span className="text-muted-foreground">{v.correct}/{v.total} · {acc}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/40 overflow-hidden">
                      <div className="h-full btn-gradient rounded-full" style={{ width: `${acc}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Overall accuracy trend */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Accuracy trend</h2>
            <span className="text-xs text-muted-foreground">{sessions.length} quiz{sessions.length === 1 ? "" : "zes"} · most recent on the right</span>
          </div>
          <div className="mt-5 h-64">
            {overallSeries.length < 2
              ? <EmptyChart label="Needs at least 2 completed quizzes to plot a trend." />
              : <AreaTrend data={overallSeries} gradientId="adminOverall" from="hsl(221 83% 60%)" to="hsl(199 89% 60%)" />}
          </div>
        </div>

        {/* Subject-wise performance graphs */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Subject-wise performance</h2>
            <span className="text-xs text-muted-foreground">accuracy % per quiz</span>
          </div>
          {perSubject.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">No quiz activity yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {perSubject.map((sub, i) => {
                const series = sessionsToSeries(sub.sessions);
                const palette = PALETTES[i % PALETTES.length];
                const avg = series.length ? Math.round(series.reduce((s, x) => s + x.accuracy, 0) / series.length) : 0;
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
                      {series.length < 2
                        ? <EmptyChart label="Not enough quizzes yet." />
                        : <AreaTrend data={series} gradientId={`admin-sub-${i}`} from={palette.from} to={palette.to} compact />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live quiz performance */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /> Live quiz performance</h2>
            <span className="text-xs text-muted-foreground">
              {live.length} participation{live.length === 1 ? "" : "s"}
              {live.length ? ` · avg ${liveAvg}%` : ""}
              {bestRank ? ` · best rank #${bestRank}` : ""}
            </span>
          </div>
          <div className="mt-5 h-64">
            {liveSeries.length < 2
              ? <EmptyChart label="This student has not joined enough live quizzes yet." />
              : <AreaTrend data={liveSeries} gradientId="adminLive" from="hsl(280 80% 65%)" to="hsl(320 80% 65%)" />}
          </div>
        </div>

        {/* Live quiz attempt history */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Live quiz attempt history</h2>
            <span className="text-xs text-muted-foreground">{live.filter((row) => row.answered_count > 0).length} attempted</span>
          </div>
          {live.filter((row) => row.answered_count > 0).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">This student has not attempted a live quiz yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border"><th className="px-3 py-3">Quiz</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Answered</th><th className="px-3 py-3">Correct</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Time</th></tr>
                </thead>
                <tbody>
                  {[...live].filter((row) => row.answered_count > 0).reverse().map((row) => (
                    <tr key={row.live_quiz_id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3 font-medium">{row.quiz?.subject_id ? subjectMap[row.quiz.subject_id] ?? "Live Quiz" : "Live Quiz"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{row.quiz ? new Date(row.quiz.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                      <td className="px-3 py-3">{row.answered_count}/{row.quiz?.questions_total ?? "—"}</td>
                      <td className="px-3 py-3 text-success">{row.correct_count}</td>
                      <td className="px-3 py-3 font-semibold">{row.score}</td>
                      <td className="px-3 py-3">{row.rank ? `#${row.rank}` : "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{Math.round(row.total_time_ms / 1000)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl glass-tint text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}
