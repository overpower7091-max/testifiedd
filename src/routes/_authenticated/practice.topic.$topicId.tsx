import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Clock, CheckCircle2, XCircle, ArrowRight, Trophy, RotateCcw } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Latex } from "@/components/latex";
import { ReportQuestionDialog } from "@/components/report-question-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/practice/topic/$topicId")({
  head: () => ({ meta: [{ title: "Practice — Testified" }] }),
  component: TopicPractice,
});

type Q = { id: string; question: string; options: string[]; correct_answer: number; explanation: string | null; difficulty: string };

function TopicPractice() {
  const { topicId } = Route.useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Q[]>([]);
  const [topic, setTopic] = useState<{ name: string; chapter_id: string } | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<{ correct: boolean }[]>([]);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => (globalThis.crypto?.randomUUID?.() ?? String(Date.now())));
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const loadQuestions = async () => {
    const { data: t } = await supabase.from("topics").select("name, chapter_id").eq("id", topicId).maybeSingle();
    setTopic(t as any);
    let subId: string | null = null;
    let chId: string | null = null;
    if (t) {
      chId = (t as any).chapter_id;
      const { data: c } = await supabase.from("chapters").select("subject_id").eq("id", chId!).maybeSingle();
      subId = (c as any)?.subject_id ?? null;
    }
    setChapterId(chId);
    setSubjectId(subId);
    const { data: banks } = await supabase.from("question_banks").select("id").eq("topic_id", topicId);
    const bankIds = (banks ?? []).map((b: any) => b.id);
    if (!bankIds.length) { setQuestions([]); return; }
    const { data: qs } = await supabase.from("questions")
      .select("id, question, options, correct_answer, explanation, difficulty")
      .in("question_bank_id", bankIds);
    const cleaned = (qs ?? []).map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
      correct_answer: typeof q.correct_answer === "number" ? q.correct_answer : Number(q.correct_answer ?? 0),
    }));
    cleaned.sort(() => Math.random() - 0.5);
    setQuestions(cleaned.slice(0, 10) as any);
  };

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      setUserId(userRes.user?.id ?? null);
      await loadQuestions();
      setStartedAt(Date.now());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt, done]);

  const q = questions[idx];
  const progress = questions.length ? ((idx + (revealed ? 1 : 0)) / questions.length) * 100 : 0;

  const submit = async () => {
    if (selected == null || !q || revealed) return;
    setRevealed(true);
    const isCorrect = selected === q.correct_answer;
    setAnswers((a) => [...a, { correct: isCorrect }]);
    if (userId) {
      const { data: attempt } = await supabase.from("quiz_attempts").insert({
        user_id: userId, question_id: q.id, chapter_id: chapterId,
        subject_id: subjectId, topic_id: topicId, session_id: sessionId,
        selected_index: selected, is_correct: isCorrect, time_seconds: elapsed,
      }).select("id").single();
      setAttemptId(attempt?.id ?? null);
      if (isCorrect) {
        const { data: p } = await supabase.from("profiles").select("xp").eq("id", userId).maybeSingle();
        await supabase.from("profiles").update({ xp: (p?.xp ?? 0) + 10 }).eq("id", userId);
      }
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) { setDone(true); return; }
    setIdx(idx + 1); setSelected(null); setRevealed(false); setAttemptId(null); setStartedAt(Date.now()); setElapsed(0);
  };

  const restart = async () => {
    setLoading(true);
    setIdx(0); setSelected(null); setRevealed(false); setAnswers([]); setDone(false);
    setSessionId(globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    await loadQuestions();
    setStartedAt(Date.now()); setElapsed(0);
    setLoading(false);
  };

  const correctCount = answers.filter((a) => a.correct).length;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!questions.length) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 py-16">
          <div className="glass-strong rounded-3xl p-8 text-center">
            <h1 className="text-2xl font-semibold">No questions yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">This subtopic doesn't have questions available.</p>
            <button onClick={() => navigate({ to: "/subjects" })} className="mt-6 btn-gradient rounded-full px-5 py-2 text-sm font-medium">Back to subjects</button>
          </div>
        </main>
      </div>
    );
  }

  if (done) {
    const acc = Math.round((correctCount / questions.length) * 100);
    const feedback =
      acc === 100 ? { title: "Flawless!", subtitle: "Perfect score — you nailed every question.", tint: "text-emerald-400" } :
      acc >= 80  ? { title: "Excellent!", subtitle: "Strong grasp of this topic — keep it up.", tint: "text-emerald-400" } :
      acc >= 60  ? { title: "Good effort", subtitle: "Solid foundation. Review the misses and try again.", tint: "text-sky-400" } :
      acc >= 40  ? { title: "Keep pushing", subtitle: "You're getting there — revise the concepts and retake.", tint: "text-amber-400" } :
      acc >= 20  ? { title: "Needs practice", subtitle: "Go through the chapter once more, then attempt again.", tint: "text-orange-400" } :
                   { title: "Don't give up", subtitle: "Every expert started here. Study the explanations and retry.", tint: "text-rose-400" };
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="glass-strong rounded-3xl p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full glass-tint text-primary">
              <Trophy className="h-10 w-10" />
            </div>
            <h1 className={`mt-4 text-3xl font-semibold tracking-tight ${feedback.tint}`}>{feedback.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">{feedback.subtitle}</p>
            <p className="mt-3 text-xs text-muted-foreground">{topic?.name}</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="glass rounded-2xl p-3"><div className="text-xs text-muted-foreground">Score</div><div className="text-xl font-semibold gradient-text">{correctCount}/{questions.length}</div></div>
              <div className="glass rounded-2xl p-3"><div className="text-xs text-muted-foreground">Accuracy</div><div className="text-xl font-semibold gradient-text">{acc}%</div></div>
              <div className="glass rounded-2xl p-3"><div className="text-xs text-muted-foreground">XP</div><div className="text-xl font-semibold gradient-text">+{correctCount * 10}</div></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <button onClick={restart} className="glass rounded-full px-5 py-2 text-sm font-medium hover:text-primary inline-flex items-center gap-2"><RotateCcw className="h-4 w-4" /> New 10 questions</button>
              <Link to="/history/session/$sessionId" params={{ sessionId }} className="glass rounded-full px-5 py-2 text-sm font-medium hover:text-primary inline-flex items-center gap-2">Review answers</Link>
              {subjectId && (
                <Link to="/subject/$id" params={{ id: subjectId }} className="btn-gradient rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2">More subtopics <ArrowRight className="h-4 w-4" /></Link>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader back={subjectId ? { to: "/subject/$id", params: { id: subjectId } } : { to: "/subjects" }} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {idx + 1} of {questions.length}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsed}s</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/40 overflow-hidden">
          <div className="h-full btn-gradient rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-6 glass-strong rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary/80 font-medium">
            <span>{topic?.name}</span>
            <span>·</span>
            <span className="capitalize">{q.difficulty}</span>
          </div>
          <h1 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight leading-snug">
            <Latex>{q.question}</Latex>
          </h1>

          <div className="mt-5 space-y-2">
            {q.options.map((opt: string, i: number) => {
              const isSelected = selected === i;
              const isCorrect = revealed && i === q.correct_answer;
              const isWrong = revealed && isSelected && i !== q.correct_answer;
              return (
                <button
                  key={i}
                  onClick={() => !revealed && setSelected(i)}
                  disabled={revealed}
                  className={`w-full text-left glass rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${
                    isCorrect ? "!bg-emerald-500/15 ring-1 ring-emerald-500/40" :
                    isWrong ? "!bg-red-500/15 ring-1 ring-red-500/40" :
                    isSelected ? "ring-1 ring-primary/60" : "hover:scale-[1.005]"
                  }`}
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isCorrect ? "bg-emerald-500 text-white" : isWrong ? "bg-red-500 text-white" : isSelected ? "btn-gradient" : "glass-tint text-primary"
                  }`}>{String.fromCharCode(65 + i)}</div>
                  <span className="text-sm flex-1"><Latex>{opt}</Latex></span>
                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {isWrong && <XCircle className="h-4 w-4 text-red-500" />}
                </button>
              );
            })}
          </div>

          {revealed && q.explanation && (
            <div className="mt-5 glass-tint rounded-2xl p-4 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Explanation</div>
              <p className="mt-1 text-foreground/90"><Latex>{q.explanation}</Latex></p>
            </div>
          )}

          {revealed && (
            <div className="mt-4 flex justify-end">
              <ReportQuestionDialog questionId={q.id} source="practice" quizAttemptId={attemptId} />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            {!revealed ? (
              <button onClick={submit} disabled={selected == null}
                className="btn-gradient rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-40">
                Submit
              </button>
            ) : (
              <button onClick={next} className="btn-gradient rounded-full px-6 py-2.5 text-sm font-medium inline-flex items-center gap-2">
                {idx + 1 >= questions.length ? "Finish" : "Next"} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
