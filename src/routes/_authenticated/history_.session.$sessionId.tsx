import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Clock, Target, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Latex } from "@/components/latex";
import { supabase } from "@/integrations/supabase/client";
import { ReportQuestionDialog } from "@/components/report-question-dialog";

export const Route = createFileRoute("/_authenticated/history_/session/$sessionId")({
  head: () => ({ meta: [{ title: "Quiz review — Testified" }] }),
  component: SessionReview,
});

function SessionReview() {
  const { sessionId } = Route.useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ topicName: string; topicId: string | null; subjectName: string; startedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { data } = await supabase.from("quiz_attempts")
        .select("id, is_correct, selected_index, time_seconds, created_at, topic_id, question:questions(id, question, options, correct_answer, explanation), subject:subjects(name), topic:topics(id, name)")
        .eq("user_id", userRes.user.id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      const list = data ?? [];
      setRows(list);
      if (list.length) {
        const first: any = list[0];
        setMeta({
          topicName: first.topic?.name ?? "Practice quiz",
          topicId: first.topic?.id ?? first.topic_id ?? null,
          subjectName: first.subject?.name ?? "",
          startedAt: first.created_at,
        });
      }
      setLoading(false);
    })();
  }, [sessionId]);

  const correct = rows.filter((r) => r.is_correct).length;
  const total = rows.length;
  const acc = total ? Math.round((correct / total) * 100) : 0;
  const seconds = rows.reduce((s, r) => s + (r.time_seconds || 0), 0);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/history" }} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <Link to="/history" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> All quizzes</Link>
          <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-widest text-primary/80 font-medium">
            <Trophy className="h-3.5 w-3.5" /> Quiz review
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">{meta?.topicName ?? "Practice quiz"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {meta?.subjectName ? `${meta.subjectName} · ` : ""}{meta ? new Date(meta.startedAt).toLocaleString() : ""}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="Score" value={`${correct}/${total}`} />
            <Stat label="Accuracy" value={`${acc}%`} icon={<Target className="h-3 w-3" />} />
            <Stat label="Time" value={formatDuration(seconds)} icon={<Clock className="h-3 w-3" />} />
          </div>
          {meta?.topicId && (
            <div className="mt-5">
              <Link to="/practice/topic/$topicId" params={{ topicId: meta.topicId }} className="btn-gradient inline-flex rounded-full px-5 py-2 text-sm font-medium">Try again</Link>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {rows.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">No questions found for this quiz.</div>
          ) : rows.map((r, i) => {
            const q = r.question;
            const options: string[] = Array.isArray(q?.options) ? q.options : [];
            const correctIdx = typeof q?.correct_answer === "number" ? q.correct_answer : Number(q?.correct_answer ?? 0);
            const chosen = r.selected_index;
            return (
              <div key={r.id} className="glass rounded-3xl p-5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Question {i + 1}</span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${r.is_correct ? "text-emerald-400" : "text-rose-400"}`}>
                    {r.is_correct ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {r.is_correct ? "Correct" : "Incorrect"} · {r.time_seconds}s
                  </span>
                </div>
                <div className="mt-2 text-base font-medium leading-snug"><Latex>{q?.question ?? ""}</Latex></div>
                <div className="mt-3 space-y-1.5">
                  {options.map((opt, oi) => {
                    const isCorrect = oi === correctIdx;
                    const isChosen = oi === chosen;
                    return (
                      <div key={oi} className={`rounded-xl px-3 py-2 text-sm flex items-center gap-2 border ${
                        isCorrect ? "bg-emerald-500/10 border-emerald-500/40" :
                        isChosen ? "bg-rose-500/10 border-rose-500/40" :
                        "border-white/10"
                      }`}>
                        <span className="h-6 w-6 rounded-full glass-tint text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">{String.fromCharCode(65 + oi)}</span>
                        <span className="flex-1"><Latex>{opt}</Latex></span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        {isChosen && !isCorrect && <XCircle className="h-4 w-4 text-rose-500" />}
                      </div>
                    );
                  })}
                </div>
                {q?.explanation && (
                  <div className="mt-3 glass-tint rounded-2xl p-3 text-sm">
                    <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Explanation</div>
                    <p className="mt-1 text-foreground/90"><Latex>{q.explanation}</Latex></p>
                  </div>
                )}
                {q?.id && (
                  <div className="mt-4 flex justify-end">
                    <ReportQuestionDialog questionId={q.id} source="history" quizAttemptId={r.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="mt-0.5 text-lg font-semibold gradient-text">{value}</div>
    </div>
  );
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
