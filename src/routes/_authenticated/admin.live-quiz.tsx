import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";
import {
  saveBlueprint,
  getBlueprint,
  runSchedulerNow,
  adminScheduleNow,
  listAdminLiveQuizResults,
} from "@/lib/live-quiz-admin.functions";
import { toast } from "sonner";
import { Loader2, Save, Play, Zap, Plus, Trash2, Trophy, Users, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/live-quiz")({
  head: () => ({ meta: [
    { title: "Live Quiz Admin — Testified" },
    { name: "description", content: "Configure live quizzes and review class leaderboards and student results." },
    { property: "og:title", content: "Live Quiz Admin — Testified" },
    { property: "og:description", content: "Configure live quizzes and review class leaderboards and student results." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LiveQuizConfig,
});

const LEVELS = ["6", "7", "8", "9", "10", "11", "12"] as const;

type TopicRow = { topic_id: string; question_count: number };

function LiveQuizConfig() {
  const [level, setLevel] = useState<string>("10");
  const [subjects, setSubjects] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [topicsAvail, setTopicsAvail] = useState<{ id: string; name: string; chapter: string }[]>([]);
  const [selected, setSelected] = useState<TopicRow[]>([]);
  const [total, setTotal] = useState(10);
  const [seconds, setSeconds] = useState(90);
  const [easy, setEasy] = useState(4);
  const [medium, setMedium] = useState(4);
  const [hard, setHard] = useState(2);
  const [lookback, setLookback] = useState(6);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultData, setResultData] = useState<any>({ quizzes: [], participants: [] });
  const [resultQuizId, setResultQuizId] = useState("");

  const save = useServerFn(saveBlueprint);
  const getBP = useServerFn(getBlueprint);
  const runTick = useServerFn(runSchedulerNow);
  const schedNow = useServerFn(adminScheduleNow);
  const loadResults = useServerFn(listAdminLiveQuizResults);

  useEffect(() => {
    let activeRequest = true;
    setResultLoading(true);
    loadResults({ data: { class_level: level } })
      .then((result) => {
        if (!activeRequest) return;
        setResultData(result);
        setResultQuizId(result.quizzes[0]?.id ?? "");
      })
      .catch((error) => toast.error(error?.message ?? "Could not load live quiz results"))
      .finally(() => activeRequest && setResultLoading(false));
    return () => { activeRequest = false; };
  }, [level]);

  // Load subjects for selected level
  useEffect(() => {
    (async () => {
      const { data: cls } = await supabase.from("classes").select("id").eq("level", level as any);
      if (!cls?.length) {
        setSubjects([]);
        return;
      }
      const { data: subs } = await supabase
        .from("subjects")
        .select("id, name, slug, class_id")
        .in("class_id", cls.map((c) => c.id))
        .order("position");
      const filtered = (subs ?? []).filter((s) =>
        ["mathematics", "physical-science", "life-science"].includes(s.slug),
      );
      setSubjects(filtered);
      setSubjectId(filtered[0]?.id ?? "");
    })();
  }, [level]);

  // Load topics + existing blueprint when subject changes
  useEffect(() => {
    if (!subjectId) return;
    (async () => {
      setLoading(true);
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id, name")
        .eq("subject_id", subjectId)
        .order("position");
      const chIds = (chapters ?? []).map((c) => c.id);
      const chMap: Record<string, string> = {};
      (chapters ?? []).forEach((c) => (chMap[c.id] = c.name));
      const { data: topics } = chIds.length
        ? await supabase.from("topics").select("id, name, chapter_id").in("chapter_id", chIds).order("position")
        : { data: [] as any };
      setTopicsAvail(
        (topics ?? []).map((t: any) => ({ id: t.id, name: t.name, chapter: chMap[t.chapter_id] ?? "" })),
      );
      // Existing blueprint
      const res = await getBP({ data: { class_level: level, subject_id: subjectId } });
      if (res.blueprint) {
        setTotal(res.blueprint.questions_total);
        setSeconds(res.blueprint.question_seconds);
        setEasy(res.blueprint.difficulty_easy);
        setMedium(res.blueprint.difficulty_medium);
        setHard(res.blueprint.difficulty_hard);
        setLookback(res.blueprint.lookback_weeks);
        setActive(res.blueprint.is_active);
        setSelected(res.topics.map((t: any) => ({ topic_id: t.topic_id, question_count: t.question_count })));
      } else {
        setSelected([]);
      }
      setLoading(false);
    })();
  }, [subjectId, level]);

  const topicSum = useMemo(() => selected.reduce((s, t) => s + t.question_count, 0), [selected]);
  const diffSum = easy + medium + hard;
  const validTopic = topicSum === total;
  const validDiff = diffSum === total;

  const addTopic = (topic_id: string) => {
    if (selected.find((t) => t.topic_id === topic_id)) return;
    setSelected([...selected, { topic_id, question_count: 1 }]);
  };
  const removeTopic = (topic_id: string) => setSelected(selected.filter((t) => t.topic_id !== topic_id));
  const setTopicCount = (topic_id: string, n: number) =>
    setSelected(selected.map((t) => (t.topic_id === topic_id ? { ...t, question_count: Math.max(0, n) } : t)));

  const handleSave = async () => {
    if (!validTopic || !validDiff) {
      toast.error("Fix distribution mismatches before saving");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          class_level: level,
          subject_id: subjectId,
          questions_total: total,
          question_seconds: seconds,
          difficulty_easy: easy,
          difficulty_medium: medium,
          difficulty_hard: hard,
          lookback_weeks: lookback,
          is_active: active,
          topics: selected,
        },
      });
      toast.success("Blueprint saved. Weekly quizzes will use this from now on.");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      await schedNow({ data: { class_level: level, subject_id: subjectId, minutes_from_now: 1 } });
      toast.success("Test quiz scheduled to start in ~1 minute");
      await runTick({});
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to schedule");
    }
  };

  const availableTopics = topicsAvail.filter((t) => !selected.find((s) => s.topic_id === t.id));
  const selectedResultQuiz = resultData.quizzes.find((quiz: any) => quiz.id === resultQuizId);
  const selectedParticipants = resultData.participants.filter((row: any) => row.live_quiz_id === resultQuizId);
  const attemptedParticipants = selectedParticipants.filter((row: any) => row.answered_count > 0);
  const joinedOnlyCount = selectedParticipants.length - attemptedParticipants.length;

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Admin</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Live Quiz <span className="gradient-text">Configuration</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set the persistent syllabus blueprint per class + subject. Weekly quizzes at 21:00 IST auto-regenerate from
            this blueprint.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="glass rounded-3xl p-4 space-y-4 h-fit sticky top-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Class</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      level === l ? "btn-gradient text-white" : "glass hover:text-primary"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</label>
              <div className="mt-2 space-y-1.5">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubjectId(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition ${
                      subjectId === s.id ? "glass-strong text-primary" : "glass hover:text-primary"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
                {subjects.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2">
                    No Math/Physical Sci/Life Sci subjects for Class {level}.
                  </div>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                onClick={handleRunNow}
                disabled={!subjectId || !selected.length}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full glass px-3 py-2 text-xs font-medium hover:text-primary disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" /> Test: run in 1 min
              </button>
              <button
                onClick={() => runTick({}).then(() => toast.success("Scheduler ticked"))}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full glass px-3 py-2 text-xs font-medium hover:text-primary"
              >
                <Play className="h-3.5 w-3.5" /> Run scheduler now
              </button>
            </div>
          </aside>

          {/* Main config */}
          <section className="glass rounded-3xl p-6 space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !subjectId ? (
              <div className="text-sm text-muted-foreground py-8">Select a class + subject.</div>
            ) : (
              <>
                {/* Quiz params */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <NumField label="Total questions" value={total} setValue={setTotal} min={1} max={50} />
                  <NumField label="Seconds / question" value={seconds} setValue={setSeconds} min={10} max={600} />
                  <NumField label="Lookback (weeks)" value={lookback} setValue={setLookback} min={0} max={52} />
                  <div className="glass rounded-xl p-3">
                    <label className="text-xs text-muted-foreground">Status</label>
                    <button
                      onClick={() => setActive(!active)}
                      className={`mt-2 w-full rounded-full px-3 py-1.5 text-xs font-medium ${
                        active ? "btn-gradient text-white" : "glass"
                      }`}
                    >
                      {active ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Difficulty distribution</h3>
                    <span className={`text-xs ${validDiff ? "text-emerald-500" : "text-red-500"}`}>
                      {diffSum} / {total}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <NumField label="Easy" value={easy} setValue={setEasy} min={0} max={total} />
                    <NumField label="Medium" value={medium} setValue={setMedium} min={0} max={total} />
                    <NumField label="Hard" value={hard} setValue={setHard} min={0} max={total} />
                  </div>
                </div>

                {/* Topics */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Topic blueprint</h3>
                    <span className={`text-xs ${validTopic ? "text-emerald-500" : "text-red-500"}`}>
                      {topicSum} / {total}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selected.length === 0 && (
                      <div className="text-xs text-muted-foreground">No topics selected yet.</div>
                    )}
                    {selected.map((s) => {
                      const t = topicsAvail.find((tt) => tt.id === s.topic_id);
                      return (
                        <div key={s.topic_id} className="glass rounded-xl p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{t?.name ?? "Unknown topic"}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{t?.chapter}</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={s.question_count}
                            onChange={(e) => setTopicCount(s.topic_id, Number(e.target.value))}
                            className="w-16 rounded-lg glass px-2 py-1 text-sm text-center bg-transparent"
                          />
                          <button
                            onClick={() => removeTopic(s.topic_id)}
                            className="p-1.5 rounded-lg glass hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {availableTopics.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-primary flex items-center gap-1">
                        <Plus className="h-3.5 w-3.5" /> Add topic ({availableTopics.length} available)
                      </summary>
                      <div className="mt-2 grid gap-1 max-h-64 overflow-auto">
                        {availableTopics.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => addTopic(t.id)}
                            className="text-left glass rounded-lg px-3 py-2 text-xs hover:text-primary"
                          >
                            <div className="font-medium">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground">{t.chapter}</div>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                  <button
                    onClick={handleSave}
                    disabled={saving || !validTopic || !validDiff}
                    className="btn-gradient rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    blueprint
                  </button>
                  {(!validTopic || !validDiff) && (
                    <span className="text-xs text-red-500">Topic sum and difficulty sum must equal total.</span>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <section className="mt-6 glass rounded-3xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-warning font-semibold">Class {level}</div>
              <h2 className="mt-1 text-xl font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Live quiz leaderboard</h2>
              <p className="mt-1 text-xs text-muted-foreground">Only students who answered at least one question are ranked.</p>
            </div>
            <select
              value={resultQuizId}
              onChange={(event) => setResultQuizId(event.target.value)}
              className="glass min-w-[240px] rounded-xl bg-card px-3 py-2 text-sm outline-none"
              aria-label="Choose live quiz result"
            >
              {resultData.quizzes.map((quiz: any) => {
                const subject = Array.isArray(quiz.subjects) ? quiz.subjects[0]?.name : quiz.subjects?.name;
                return <option key={quiz.id} value={quiz.id}>{subject ?? "Live Quiz"} · {new Date(quiz.scheduled_at).toLocaleDateString()}</option>;
              })}
            </select>
          </div>

          {resultLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading leaderboard…</div>
          ) : !selectedResultQuiz ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No live quizzes are available for Class {level} yet.</div>
          ) : attemptedParticipants.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-border bg-muted/40 px-4 py-8 text-center">
              <Users className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 font-semibold">No participants yet</p>
              {joinedOnlyCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{joinedOnlyCount} student{joinedOnlyCount === 1 ? " joined" : "s joined"}, but no answers were submitted.</p>}
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border"><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Answered</th><th className="px-3 py-3">Correct</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">History</th></tr>
                </thead>
                <tbody>
                  {attemptedParticipants.map((row: any, index: number) => (
                    <tr key={row.user_id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3 font-semibold text-warning">#{row.rank ?? index + 1}</td>
                      <td className="px-3 py-3 font-medium">{row.profile?.full_name || "Student"}</td>
                      <td className="px-3 py-3">{row.answered_count}/{selectedResultQuiz.questions_total}</td>
                      <td className="px-3 py-3 text-success">{row.correct_count}</td>
                      <td className="px-3 py-3 font-semibold">{row.score}</td>
                      <td className="px-3 py-3 text-muted-foreground">{Math.round(row.total_time_ms / 1000)}s</td>
                      <td className="px-3 py-3"><Link to="/admin/student/$id" params={{ id: row.user_id }} className="inline-flex items-center gap-1 text-primary hover:underline"><History className="h-3.5 w-3.5" /> View attempts</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {joinedOnlyCount > 0 && <p className="mt-3 text-xs text-muted-foreground">{joinedOnlyCount} joined without submitting an answer and {joinedOnlyCount === 1 ? "is" : "are"} not ranked.</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NumField({
  label,
  value,
  setValue,
  min,
  max,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
      />
    </div>
  );
}
