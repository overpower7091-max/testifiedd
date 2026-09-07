import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, History as HistoryIcon, ChevronRight, Clock, Target } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Quiz history — Testified" }] }),
  component: History,
});

type Session = {
  key: string;
  sessionId: string | null;
  topicId: string | null;
  topicName: string;
  subjectName: string;
  total: number;
  correct: number;
  seconds: number;
  startedAt: string;
};

function History() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { data } = await supabase.from("quiz_attempts")
        .select("id, is_correct, time_seconds, created_at, session_id, topic_id, subject_id, question:questions(question_bank:question_banks(topic:topics(id, name))), subject:subjects(name)")
        .eq("user_id", userRes.user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      const grouped = new Map<string, Session>();
      for (const r of data ?? []) {
        const topicFromQ = (r as any).question?.question_bank?.topic;
        const topicId = (r as any).topic_id ?? topicFromQ?.id ?? null;
        const topicName = topicFromQ?.name ?? "Practice quiz";
        const subjectName = (r as any).subject?.name ?? "";
        // group key: session_id when present, else fall back to date+topic for legacy attempts
        const key = (r as any).session_id
          ? String((r as any).session_id)
          : `legacy:${topicId ?? "x"}:${r.created_at.slice(0, 16)}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.total += 1;
          existing.correct += r.is_correct ? 1 : 0;
          existing.seconds += r.time_seconds || 0;
          if (r.created_at < existing.startedAt) existing.startedAt = r.created_at;
        } else {
          grouped.set(key, {
            key,
            sessionId: (r as any).session_id ?? null,
            topicId,
            topicName,
            subjectName,
            total: 1,
            correct: r.is_correct ? 1 : 0,
            seconds: r.time_seconds || 0,
            startedAt: r.created_at,
          });
        }
      }
      const list = Array.from(grouped.values()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
      setSessions(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Recent</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Quiz <span className="gradient-text">history</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Every quiz you've taken. Tap one to review each question and your answers.</p>
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : sessions.length === 0 ? (
            <div className="glass rounded-3xl py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass-tint"><HistoryIcon className="h-6 w-6 text-primary" /></div>
              No quizzes yet. Start practising to see your history.
            </div>
          ) : sessions.map((s) => {
            const acc = Math.round((s.correct / s.total) * 100);
            const accTint = acc >= 80 ? "text-emerald-400" : acc >= 50 ? "text-sky-400" : "text-rose-400";
            const started = new Date(s.startedAt);
            const inner = (
              <div className="glass rounded-2xl p-4 flex items-center gap-4 hover:scale-[1.005] transition-transform">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl glass-tint text-primary shrink-0">
                  <HistoryIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.topicName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {s.subjectName ? `${s.subjectName} · ` : ""}{started.toLocaleDateString()} · {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className={`inline-flex items-center gap-1 font-semibold ${accTint}`}><Target className="h-3 w-3" /> {s.correct}/{s.total} · {acc}%</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(s.seconds)}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            );
            return s.sessionId ? (
              <Link key={s.key} to="/history/session/$sessionId" params={{ sessionId: s.sessionId }}>{inner}</Link>
            ) : (
              <div key={s.key} className="opacity-70 cursor-default">{inner}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
