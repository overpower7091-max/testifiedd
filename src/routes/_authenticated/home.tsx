import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen, Loader2,
  ArrowRight, TrendingUp, Clock, Radio,
} from "lucide-react";
import {
  RankIcon, XpIcon, StreakIcon, AccuracyIcon, CrownIcon,
  DailyQuizIcon, LiveIcon, AiSolverIcon, LeaderboardIcon, HistoryIcon,
} from "@/components/animated-icons";
import { AppHeader } from "@/components/app-header";
import { SubjectCard } from "@/components/subject-card";
import { LiveQuizReminder } from "@/components/live-quiz-reminder";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Student Dashboard — Testified" },
      { name: "description", content: "Track MCQ practice, live quiz results, goals, and performance on your Testified dashboard." },
      { property: "og:title", content: "Student Dashboard — Testified" },
      { property: "og:description", content: "Track MCQ practice, live quiz results, goals, and performance on Testified." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});


function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [liveTopper, setLiveTopper] = useState<{ name: string; score: number; subject: string } | null>(null);
  const [latestLiveQuiz, setLatestLiveQuiz] = useState<{ subject: string; hasAttempts: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const uid = userRes.user.id;

      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, class, xp, streak, onboarding_completed").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      if (!p?.onboarding_completed) { navigate({ to: "/onboarding", replace: true }); return; }

      setProfile(p);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));

      // Most recent daily live-quiz topper for this student's class.
      if (p.class) {
        const { data: latestQuiz } = await supabase.from("live_quizzes")
          .select("id, subject:subjects(name)")
          .eq("class_level", p.class)
          .eq("status", "ended")
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestQuiz) {
          const { data: winner } = await supabase.from("live_quiz_participants")
            .select("user_id, score, answered_count")
            .eq("live_quiz_id", latestQuiz.id)
            .gt("answered_count", 0)
            .order("score", { ascending: false })
            .order("correct_count", { ascending: false })
            .order("total_time_ms", { ascending: true })
            .limit(1)
            .maybeSingle();
          const subject = Array.isArray(latestQuiz.subject) ? latestQuiz.subject[0]?.name : latestQuiz.subject?.name;
          setLatestLiveQuiz({ subject: subject || "Live Quiz", hasAttempts: Boolean(winner) });
          if (winner) {
            const { data: winnerProfile } = await supabase.from("profiles")
              .select("full_name")
              .eq("id", winner.user_id)
              .maybeSingle();
            if (winnerProfile) {
              setLiveTopper({ name: winnerProfile.full_name || "Student", score: winner.score, subject: subject || "Live Quiz" });
            }
          }
        }
      }

      // Subjects for user's class
      const { data: cls } = p.class ? await supabase.from("classes").select("id").eq("level", p.class).maybeSingle() : { data: null };
      if (cls) {
        const { data: subs } = await supabase.from("subjects")
          .select("id, name").eq("class_id", cls.id).order("position").limit(4);
        const enriched = await Promise.all((subs ?? []).map(async (s: any) => {
          const [{ count: chapCount }, { data: att }] = await Promise.all([
            supabase.from("chapters").select("*", { count: "exact", head: true }).eq("subject_id", s.id),
            supabase.from("quiz_attempts").select("is_correct", { count: "exact" }).eq("user_id", uid).eq("subject_id", s.id),
          ]);
          const total = att?.length ?? 0;
          const correct = att?.filter((a: any) => a.is_correct).length ?? 0;
          return { ...s, chapters: chapCount ?? 0, attempts: total, accuracy: total ? Math.round((correct / total) * 100) : 0 };
        }));
        setSubjects(enriched);
      }

      // Recent attempts (fetch enough to group into sessions)
      const { data: recent } = await supabase.from("quiz_attempts")
        .select("id, is_correct, created_at, time_seconds, session_id, topic_id, subject:subjects(name), question:questions(question_bank:question_banks(topic:topics(id, name)))")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(200);
      setAttempts(recent ?? []);

      // Rank within class (approx by XP)
      if (p.class) {
        const { data: leaderboard } = await supabase.from("profiles")
          .select("id, xp").eq("class", p.class).order("xp", { ascending: false });
        const pos = (leaderboard ?? []).findIndex((x: any) => x.id === uid);
        setRank(pos >= 0 ? pos + 1 : null);
      }

      setLoading(false);
    })();
  }, [navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const firstName = (profile.full_name || "Student").split(" ")[0];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayAttempts = attempts.filter((a) => a.created_at.slice(0, 10) === todayKey);
  const dailyGoal = 20;
  const dailyDone = todayAttempts.length;
  const goalPct = Math.min(100, Math.round((dailyDone / dailyGoal) * 100));
  const totalCorrect = attempts.filter((a) => a.is_correct).length;
  const accuracy = attempts.length ? Math.round((totalCorrect / attempts.length) * 100) : 0;
  const studyMin = Math.round(todayAttempts.reduce((s, a) => s + (a.time_seconds || 0), 0) / 60);

  return (
    <div className="min-h-screen w-full text-foreground">
      <AppHeader isAdmin={isAdmin} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pb-16 pt-6">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-strong lg:col-span-2 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-40" style={{ background: "radial-gradient(closest-side, hsl(217 91% 60% / 0.6), transparent)" }} />
            <div className="relative">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Welcome back</div>
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
                Hi {firstName}, ready to <span className="gradient-text">level up?</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">Class {profile.class} · WBBSE · Let's crush today's goal.</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/subjects" className="btn-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium">
                  Start practising <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/live" className="inline-flex items-center gap-2 rounded-full border border-danger/60 bg-danger px-5 py-2.5 text-sm font-semibold text-destructive-foreground shadow-lg shadow-danger/20 transition-transform hover:scale-[1.03] active:scale-95">
                  <Radio className="h-4 w-4" /> Join live mock
                </Link>
              </div>

              {liveTopper && (
                <Link to="/leaderboard" className="topper-banner mt-5 flex max-w-xl items-center gap-3 overflow-hidden rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
                    <CrownIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-warning">Class {profile.class} · Daily live topper</div>
                    <div className="truncate text-sm font-semibold"><span className="topper-name">{liveTopper.name}</span> topped {liveTopper.subject} with {liveTopper.score} points</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-warning" />
                </Link>
              )}
              {latestLiveQuiz && !latestLiveQuiz.hasAttempts && (
                <div className="topper-banner mt-5 flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-muted/60 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <CrownIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Class {profile.class} · {latestLiveQuiz.subject}</div>
                    <div className="text-sm font-semibold">No participants yet</div>
                  </div>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat tone="warning" icon={<RankIcon className="h-[18px] w-[18px]" />} label="Rank" value={rank ? `#${rank}` : "—"} />
                <Stat tone="brand2" icon={<XpIcon className="h-[18px] w-[18px]" />} label="XP" value={String(profile.xp)} />
                <Stat tone="danger" icon={<StreakIcon className="h-[18px] w-[18px]" />} label="Streak" value={`${profile.streak}d`} />
                <Stat tone="success" icon={<AccuracyIcon className="h-[18px] w-[18px]" />} label="Accuracy" value={attempts.length ? `${accuracy}%` : "—"} />
              </div>
            </div>
          </div>

          <div className="glass-strong rounded-3xl p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">Today's goal</div>
                <div className="mt-1 text-lg font-semibold">Daily practice</div>
              </div>
              <div className="rounded-full glass-tint px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary font-semibold">
                {dailyDone >= dailyGoal ? "Done" : "Fresh"}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-5">
              <ProgressRing value={goalPct} />
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-semibold tracking-tight">{dailyDone}<span className="text-muted-foreground text-lg">/{dailyGoal}</span></div>
                <div className="text-xs text-muted-foreground mt-1">MCQs solved today</div>
                <Link to="/subjects" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  Start now <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              <MiniStat icon={<Clock className="h-3.5 w-3.5" />} label="Study time" value={`${studyMin}m`} />
              <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="This week" value={attempts.length ? `${accuracy}%` : "0%"} />
            </div>
          </div>
        </section>

        <section className="mt-4">
          <LiveQuizReminder />
        </section>



        {/* Subjects + Quick actions */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your subjects</h2>
              <Link to="/subjects" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subjects.length === 0 ? (
                <div className="col-span-full text-sm text-muted-foreground">No subjects yet.</div>
              ) : subjects.map((s) => (
                <SubjectCard
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  chapters={s.chapters}
                  attempts={s.attempts}
                  accuracy={s.accuracy}
                  className="min-h-[180px]"
                />
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <div className="mt-4 space-y-2.5">
              <QuickAction to="/subjects" tone="primary" icon={<DailyQuizIcon className="h-[19px] w-[19px]" />} title="Daily Quiz" desc="Today's challenge" />
              <QuickAction to="/live" tone="danger" icon={<LiveIcon className="h-[19px] w-[19px]" />} title="Live Quiz" desc="Scheduled mocks" />
              <QuickAction to="/mock" tone="brand2" icon={<AiSolverIcon className="h-[19px] w-[19px]" />} title="AI Doubt Solver" desc="Coming soon" />
              <QuickAction to="/leaderboard" tone="warning" icon={<LeaderboardIcon className="h-[19px] w-[19px]" />} title="Leaderboard" desc="Compete in your class" />
              <QuickAction to="/history" tone="success" icon={<HistoryIcon className="h-[19px] w-[19px]" />} title="Quiz History" desc="Review attempts" />
            </div>
          </div>
        </section>

        {/* Recent activity */}
        <section className="mt-6">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <Link to="/history" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {attempts.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass-tint">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Once you start solving MCQs and mock tests, your attempts appear here with insights.
                </p>
                <Link to="/subjects" className="mt-3 btn-gradient rounded-full px-5 py-2 text-sm font-medium">Start your first quiz</Link>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {groupSessions(attempts).slice(0, 5).map((s) => {
                  const acc = Math.round((s.correct / s.total) * 100);
                  const accTint = acc >= 80 ? "text-emerald-400" : acc >= 50 ? "text-sky-400" : "text-rose-400";
                  const started = new Date(s.startedAt);
                  const inner = (
                    <div className="glass rounded-2xl p-3 flex items-center gap-3 hover:scale-[1.005] transition-transform">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tint text-primary shrink-0">
                        <HistoryIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{s.topicName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {s.subjectName ? `${s.subjectName} · ` : ""}{started.toLocaleDateString()} · {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className={`inline-flex items-center gap-1 font-semibold ${accTint}`}><AccuracyIcon className="h-3.5 w-3.5" /> {s.correct}/{s.total} · {acc}%</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(s.seconds)}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                  return s.sessionId ? (
                    <Link key={s.key} to="/history/session/$sessionId" params={{ sessionId: s.sessionId }}>{inner}</Link>
                  ) : (
                    <div key={s.key} className="opacity-70 cursor-default">{inner}</div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function groupSessions(rows: any[]) {
  const map = new Map<string, { key: string; sessionId: string | null; topicName: string; subjectName: string; total: number; correct: number; seconds: number; startedAt: string }>();
  for (const r of rows) {
    const topic = r.question?.question_bank?.topic;
    const topicName = topic?.name ?? "Practice quiz";
    const subjectName = r.subject?.name ?? "";
    const key = r.session_id ? String(r.session_id) : `legacy:${r.topic_id ?? "x"}:${r.created_at.slice(0, 16)}`;
    const ex = map.get(key);
    if (ex) {
      ex.total += 1;
      ex.correct += r.is_correct ? 1 : 0;
      ex.seconds += r.time_seconds || 0;
      if (r.created_at < ex.startedAt) ex.startedAt = r.created_at;
    } else {
      map.set(key, { key, sessionId: r.session_id ?? null, topicName, subjectName, total: 1, correct: r.is_correct ? 1 : 0, seconds: r.time_seconds || 0, startedAt: r.created_at });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

type Tone = "primary" | "brand2" | "warning" | "danger" | "success";
const TONE: Record<Tone, string> = {
  primary: "var(--primary)",
  brand2: "var(--brand-2)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  success: "var(--success)",
};
function ToneChip({ tone = "primary", size, children }: { tone?: Tone; size: string; children: React.ReactNode }) {
  const c = TONE[tone];
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl`}
      style={{
        color: c,
        background: `color-mix(in oklab, ${c} 18%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 38%, transparent), 0 6px 18px -10px color-mix(in oklab, ${c} 70%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}
function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: Tone }) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
      <ToneChip tone={tone} size="h-8 w-8">{icon}</ToneChip>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}
function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-tint rounded-xl px-3 py-2 flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon} {label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
function ProgressRing({ value }: { value: number }) {
  const size = 96, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="hsl(220 20% 88%)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="url(#grad)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(221 83% 53%)" />
            <stop offset="100%" stopColor="hsl(199 89% 60%)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-semibold gradient-text">{value}%</span>
      </div>
    </div>
  );
}
function QuickAction({ to, icon, title, desc, tone }: { to: string; icon: React.ReactNode; title: string; desc: string; tone?: Tone }) {
  return (
    <Link to={to} className="w-full glass rounded-2xl px-3 py-2.5 flex items-center gap-3 hover:scale-[1.01] transition-transform text-left">
      <ToneChip tone={tone} size="h-9 w-9">{icon}</ToneChip>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
