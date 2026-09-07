import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";
import {
  getTodaysLiveQuiz,
  getUpcomingLiveQuizzes,
  joinLiveQuiz,
  getLiveSession,
  submitAnswer,
  getLeaderboard,
  getResults,
} from "@/lib/live-quiz.functions";
import { Latex } from "@/components/latex";
import { ReportQuestionDialog } from "@/components/report-question-dialog";
import { Loader2, Radio, Clock, Trophy, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({ meta: [{ title: "Live Quiz — Testified" }] }),
  component: LiveQuizPage,
});

function LiveQuizPage() {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const getToday = useServerFn(getTodaysLiveQuiz);
  const getUpcoming = useServerFn(getUpcomingLiveQuizzes);

  useEffect(() => {
    (async () => {
      const t = await getToday({});
      if (t.quiz) setQuizId(t.quiz.id);
      const list = await getUpcoming({});
      setUpcoming(list);
    })();
  }, []);

  if (!quizId) {
    return (
      <div className="min-h-screen">
        <AppHeader back={{ to: "/home" }} />
        <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10 py-6">
          <div className="glass-strong rounded-3xl p-8 text-center">
            <Radio className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-2xl font-semibold">No live quiz scheduled</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Live quizzes run daily at 9:00 PM IST (except Sunday). Check back soon!
            </p>
            <SchedulePreview upcoming={upcoming} onOpen={(id) => setQuizId(id)} />
          </div>
        </main>
      </div>
    );
  }

  return <QuizRunner quizId={quizId} onLeave={() => setQuizId(null)} upcoming={upcoming} />;
}

function SchedulePreview({ upcoming, onOpen }: { upcoming: any[]; onOpen: (id: string) => void }) {
  if (upcoming.length === 0) return null;
  return (
    <div className="mt-6 text-left">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Recent & upcoming</h3>
      <div className="mt-2 space-y-1.5">
        {upcoming.map((q) => (
          <button
            key={q.id}
            onClick={() => onOpen(q.id)}
            className="glass w-full rounded-xl px-3 py-2.5 flex items-center justify-between text-sm hover:text-primary"
          >
            <div>
              <div className="font-medium">{q.subjects?.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(q.scheduled_at).toLocaleString()}
              </div>
            </div>
            <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${statusClass(q.status)}`}>
              {q.status.replace("_", " ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function statusClass(s: string) {
  if (s === "live") return "bg-red-500/20 text-red-500";
  if (s === "ended") return "bg-emerald-500/15 text-emerald-500";
  if (s === "configuration_required") return "bg-yellow-500/15 text-yellow-500";
  return "bg-primary/15 text-primary";
}

type Session = {
  quiz_id: string;
  status: string;
  subject: string | null;
  questions_total: number;
  question_seconds: number;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  server_now: string;
  questions: { id: string; position: number; difficulty: string; text: string; options: string[]; images?: string[] }[];
  my_answers: { position: number; selected_index: number | null; is_correct: boolean }[];
};

/**
 * Downloads the whole session once, then runs entirely from memory.
 * Question index is derived from server time (anchor + index * duration),
 * so transitions are instant and every student stays in sync.
 */
function QuizRunner({
  quizId,
  onLeave,
  upcoming,
}: {
  quizId: string;
  onLeave: () => void;
  upcoming: any[];
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { selected_index: number | null; is_correct: boolean }>>({});
  const [submitting, setSubmitting] = useState(false);
  const skewRef = useRef(0);
  const anchorRef = useRef(0);
  const durRef = useRef(90_000);
  const totalRef = useRef(0);

  const join = useServerFn(joinLiveQuiz);
  const loadSession = useServerFn(getLiveSession);
  const submit = useServerFn(submitAnswer);

  const applySession = useCallback((s: Session) => {
    skewRef.current = new Date(s.server_now).getTime() - Date.now();
    anchorRef.current = new Date(s.started_at ?? s.scheduled_at).getTime();
    durRef.current = (s.question_seconds ?? 90) * 1000;
    totalRef.current = s.questions_total;
    const map: Record<number, { selected_index: number | null; is_correct: boolean }> = {};
    for (const a of s.my_answers) map[a.position] = { selected_index: a.selected_index, is_correct: a.is_correct };
    setAnswers(map);
    setSession(s);
    setStatus(s.status);
    // Preload any question images before the quiz starts
    for (const q of s.questions) {
      for (const src of q.images ?? []) {
        const img = new Image();
        img.src = src;
      }
    }
  }, []);

  const reload = useCallback(async () => {
    const s = (await loadSession({ data: { quiz_id: quizId } })) as Session;
    applySession(s);
    return s;
  }, [quizId]);

  // Single bulk download on mount (also covers refresh / reconnect)
  useEffect(() => {
    (async () => {
      try {
        await join({ data: { quiz_id: quizId } }).catch(() => null);
        await reload();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load quiz");
        setStatus("error");
      }
    })();
  }, [quizId]);

  // Realtime: only important events (start / end / cancel) trigger a reload
  useEffect(() => {
    const channel = supabase
      .channel(`live_quiz_${quizId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_quizzes", filter: `id=eq.${quizId}` },
        (payload: any) => {
          const next = payload.new?.status;
          if (next && next !== status) reload().catch(() => null);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, status]);

  // Derive the current index from server time. No DB reads here.
  useEffect(() => {
    if (status !== "live") return;
    const tick = () => {
      const serverNow = Date.now() + skewRef.current;
      const i = Math.floor((serverNow - anchorRef.current) / durRef.current);
      if (i >= totalRef.current) {
        setStatus("awaiting_results");
        return;
      }
      setIndex((prev) => (prev === i ? prev : Math.max(0, i)));
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [status]);

  // While results are being computed, poll status until it flips to ended
  useEffect(() => {
    if (status !== "awaiting_results" && status !== "scheduled" && status !== "configuration_required") return;
    const iv = setInterval(() => {
      reload().catch(() => null);
    }, 4000);
    return () => clearInterval(iv);
  }, [status, reload]);

  const handleSubmit = useCallback(
    async (idx: number) => {
      if (submitting || answers[index]) return;
      setSubmitting(true);
      // Optimistic lock — UI never waits for the network
      setAnswers((prev) => ({ ...prev, [index]: { selected_index: idx, is_correct: false } }));
      try {
        const r = await submit({ data: { quiz_id: quizId, position: index, selected_index: idx } });
        setAnswers((prev) => ({ ...prev, [index]: { selected_index: idx, is_correct: r.is_correct } }));
      } catch (e: any) {
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        toast.error(e?.message ?? "Submit failed");
      } finally {
        setSubmitting(false);
      }
    },
    [index, answers, submitting, quizId],
  );

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "cancelled" || status === "error") {
    return (
      <div className="min-h-screen">
        <AppHeader back={{ to: "/home" }} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center">
          <div className="glass-strong rounded-3xl p-8">
            <h1 className="text-2xl font-semibold">Today's live quiz is unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please check back later.</p>
          </div>
        </main>
      </div>
    );
  }

  if (status === "configuration_required") {
    const startsInMs = new Date(session.scheduled_at).getTime() - (Date.now() + skewRef.current);
    return (
      <div className="min-h-screen">
        <AppHeader back={{ to: "/home" }} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="glass-strong rounded-3xl p-8 text-center">
            <div className="text-xs uppercase tracking-widest text-primary/80">Live Quiz</div>
            <h1 className="mt-2 text-3xl font-semibold gradient-text">{session.subject ?? "Today's quiz"}</h1>
            <CountdownToStart
              targetMs={new Date(session.scheduled_at).getTime()}
              skewRef={skewRef}
              onReached={() => reload().catch(() => null)}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Starts at {new Date(session.scheduled_at).toLocaleTimeString()} — {session.questions_total} questions,{" "}
              {session.question_seconds}s each.
            </p>
            <p className="mt-3 text-xs text-yellow-500">
              {startsInMs > 6 * 60_000
                ? "Questions are picked automatically a few minutes before the start."
                : "Waiting for the question set to be prepared. If this persists, an admin needs to enable the blueprint for this class & subject."}
            </p>
            <button onClick={onLeave} className="mt-6 text-xs text-muted-foreground hover:text-primary">
              ← Back
            </button>
          </div>
          <SchedulePreview upcoming={upcoming} onOpen={() => {}} />
        </main>
      </div>
    );
  }


  if (status === "scheduled" || status === "generating") {
    return (
      <div className="min-h-screen">
        <AppHeader back={{ to: "/home" }} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="glass-strong rounded-3xl p-8 text-center">
            <div className="text-xs uppercase tracking-widest text-primary/80">Live Quiz</div>
            <h1 className="mt-2 text-3xl font-semibold gradient-text">{session.subject}</h1>
            <CountdownToStart
              targetMs={new Date(session.scheduled_at).getTime()}
              skewRef={skewRef}
              onReached={() => reload().catch(() => null)}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Starts at {new Date(session.scheduled_at).toLocaleTimeString()} — {session.questions_total} questions,{" "}
              {session.question_seconds}s each.
            </p>
            <button onClick={onLeave} className="mt-6 text-xs text-muted-foreground hover:text-primary">
              ← Back
            </button>
          </div>
          <SchedulePreview upcoming={upcoming} onOpen={() => {}} />
        </main>
      </div>
    );
  }

  if (status === "ended") {
    return <ResultsView quizId={quizId} onLeave={onLeave} />;
  }

  if (status === "awaiting_results") {
    return (
      <div className="min-h-screen">
        <AppHeader back={{ to: "/home" }} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center">
          <div className="glass-strong rounded-3xl p-8">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-semibold">Calculating results…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Scores, ranks and the final leaderboard are being published.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // LIVE — layout/header/timer stay mounted; only the question card swaps.
  const q = session.questions.find((x) => x.position === index) ?? null;
  const answered = answers[index] ?? null;

  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <div className="glass-strong rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Live · {session.subject}
              </div>
              <div className="mt-1 text-lg font-semibold">
                Question {index + 1} <span className="text-muted-foreground">of {session.questions_total}</span>
              </div>
            </div>
            <QuestionTimer
              index={index}
              anchorRef={anchorRef}
              durRef={durRef}
              skewRef={skewRef}
              seconds={session.question_seconds}
            />
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full btn-gradient transition-all"
              style={{ width: `${((index + 1) / session.questions_total) * 100}%` }}
            />
          </div>

          <QuestionCard
            question={q}
            selected={answered?.selected_index ?? null}
            locked={!!answered}
            submitting={submitting}
            onSelect={handleSubmit}
              liveQuizId={quizId}
          />
        </div>

        <div className="mt-6 glass rounded-3xl p-5 text-center text-xs text-muted-foreground">
          <Trophy className="mx-auto h-4 w-4 text-primary" />
          <p className="mt-2">The leaderboard is published as soon as the quiz ends.</p>
        </div>

      </main>
    </div>
  );
}

const QuestionCard = memo(function QuestionCard({
  question,
  selected,
  locked,
  submitting,
  onSelect,
  liveQuizId,
}: {
  question: { id: string; text: string; options: string[]; difficulty: string } | null;
  selected: number | null;
  locked: boolean;
  submitting: boolean;
  onSelect: (idx: number) => void;
  liveQuizId: string;
}) {
  if (!question) {
    return <div className="mt-6 text-sm text-muted-foreground text-center py-8">Waiting for question…</div>;
  }
  return (
    <div className="animate-in fade-in duration-200">
      <div className="mt-6 text-lg leading-relaxed">
        <Latex>{question.text}</Latex>
      </div>
      <div className="mt-5 space-y-2">
        {question.options.map((opt: string, idx: number) => {
          const isSel = selected === idx;
          return (
            <button
              key={idx}
              disabled={locked || submitting}
              onClick={() => onSelect(idx)}
              className={`w-full text-left rounded-2xl px-4 py-3 transition ${
                isSel ? "btn-gradient text-white" : locked ? "glass opacity-60 cursor-not-allowed" : "glass hover:text-primary"
              }`}
            >
              <span className="text-xs font-bold mr-2 opacity-70">{String.fromCharCode(65 + idx)}.</span>
              <Latex>{opt}</Latex>
            </button>
          );
        })}
      </div>
      {locked && (
        <div className="mt-4 text-sm text-center text-muted-foreground">
          Answer locked · waiting for next question…
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <ReportQuestionDialog questionId={question.id} source="live" liveQuizId={liveQuizId} />
      </div>
    </div>
  );
});

function QuestionTimer({
  index,
  anchorRef,
  durRef,
  skewRef,
  seconds,
}: {
  index: number;
  anchorRef: React.MutableRefObject<number>;
  durRef: React.MutableRefObject<number>;
  skewRef: React.MutableRefObject<number>;
  seconds: number;
}) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const tick = () => {
      const serverNow = Date.now() + skewRef.current;
      const end = anchorRef.current + (index + 1) * durRef.current;
      setRemaining(Math.max(0, Math.ceil((end - serverNow) / 1000)));
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [index]);
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-primary" />
      <span className={`text-2xl font-bold tabular-nums ${remaining <= 10 ? "text-red-500" : "text-foreground"}`}>
        {remaining}s
      </span>
    </div>
  );
}

function CountdownToStart({
  targetMs,
  skewRef,
  onReached,
}: {
  targetMs: number;
  skewRef: React.MutableRefObject<number>;
  onReached: () => void;
}) {
  const [sec, setSec] = useState(0);
  const firedRef = useRef(false);
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((targetMs - (Date.now() + skewRef.current)) / 1000));
      setSec(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        onReached();
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [targetMs]);
  return <div className="mt-6 text-6xl font-bold tabular-nums">{formatHMS(sec)}</div>;
}


function LiveLeaderboard({ quizId }: { quizId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const load = useServerFn(getLeaderboard);
  useEffect(() => {
    const run = () => load({ data: { quiz_id: quizId } }).then((r) => {
      setRows(r.rows.slice(0, 10));
      setMe(r.me);
    }).catch(() => null);
    run();
    const channel = supabase
      .channel(`lb_${quizId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_quiz_participants", filter: `live_quiz_id=eq.${quizId}` }, run)
      .subscribe();
    const iv = setInterval(run, 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(iv);
    };
  }, [quizId]);
  return (
    <div className="mt-6 glass rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold inline-flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Live leaderboard
        </h3>
        {me && <div className="text-xs text-muted-foreground">You: #{me.rank ?? "—"} · {me.score} pts</div>}
      </div>
      <div className="mt-3 space-y-1">
        {rows.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">No participants yet.</div>}
        {rows.map((r, i) => (
          <div key={r.user_id} className={`flex items-center justify-between glass rounded-xl px-3 py-2 text-sm ${me?.user_id === r.user_id ? "ring-1 ring-primary" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs w-6 text-primary">#{i + 1}</span>
              <span className="truncate">{r.name}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span>{r.correct}✓</span>
              <span className="font-semibold text-foreground">{r.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsView({ quizId, onLeave }: { quizId: string; onLeave: () => void }) {
  const [data, setData] = useState<any>(null);
  const load = useServerFn(getResults);
  useEffect(() => {
    load({ data: { quiz_id: quizId } }).then(setData);
  }, [quizId]);
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const me = data.me;
  const total = data.quiz.questions_total;
  const correct = me?.correct_count ?? 0;
  const answered = me?.answered_count ?? 0;
  const notAttempted = total - answered;
  const wrong = answered - correct;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const avgSec = answered ? Math.round((me.total_time_ms ?? 0) / answered / 100) / 10 : 0;
  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div className="glass-strong rounded-3xl p-6 text-center">
          <div className="text-xs uppercase tracking-widest text-primary/80">{data.quiz.subjects?.name} · Result</div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Score" value={me?.score ?? 0} />
            <Stat label="Rank" value={me?.rank ? `#${me.rank}` : "—"} />
            <Stat label="Percentile" value={data.percentile ? `${data.percentile}%` : "—"} />
            <Stat label="Accuracy" value={`${accuracy}%`} />
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div className="glass rounded-xl py-2">Correct <span className="text-emerald-500 font-semibold ml-1">{correct}</span></div>
            <div className="glass rounded-xl py-2">Wrong <span className="text-red-500 font-semibold ml-1">{wrong}</span></div>
            <div className="glass rounded-xl py-2">Not attempted <span className="font-semibold ml-1 text-foreground">{notAttempted}</span></div>
            <div className="glass rounded-xl py-2">Avg time <span className="font-semibold ml-1 text-foreground">{avgSec}s</span></div>
          </div>
        </div>

        <LiveLeaderboard quizId={quizId} />

        {data.can_review && data.review.length > 0 && (
          <div className="glass rounded-3xl p-5">
            <h3 className="text-sm font-semibold">Review</h3>
            <div className="mt-3 space-y-4">
              {data.review.map((r: any) => (
                <div key={r.position} className="glass-tint rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Q{r.position + 1} · {r.difficulty}</span>
                    {r.my_selected == null ? (
                      <span className="text-xs text-muted-foreground">Not attempted</span>
                    ) : r.is_correct ? (
                      <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Correct</span>
                    ) : (
                      <span className="text-xs text-red-500 flex items-center gap-1"><XCircle className="h-3 w-3" /> Wrong</span>
                    )}
                  </div>
                  <div className="text-sm"><Latex>{r.question}</Latex></div>
                  <div className="mt-2 space-y-1">
                    {r.options.map((o: string, i: number) => {
                      const isCorrect = i === r.correct;
                      const isMine = i === r.my_selected;
                      return (
                        <div key={i} className={`rounded-lg px-3 py-2 text-sm ${
                          isCorrect ? "bg-emerald-500/15 text-emerald-500" :
                          isMine ? "bg-red-500/15 text-red-500" : "glass"
                        }`}>
                          <span className="text-xs font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                          <Latex>{o}</Latex>
                        </div>
                      );
                    })}
                  </div>
                  {r.explanation && (
                    <div className="mt-2 text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
                      <Latex>{r.explanation}</Latex>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-primary">← Back</button>
        <Link to="/leaderboard" className="ml-4 text-xs text-primary hover:underline">View overall leaderboard <ChevronRight className="inline h-3 w-3" /></Link>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="glass rounded-xl px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function formatHMS(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
