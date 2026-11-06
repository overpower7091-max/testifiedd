import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";
import { MIXED_MAX, MIXED_MIN, MIXED_PREFIX } from "@/lib/mixed-practice";

export const Route = createFileRoute("/_authenticated/syllabus/$subjectId")({
  head: () => ({
    meta: [
      { title: "My Syllabus — Testified" },
      { name: "description", content: "Pick the topics in your school exam for mixed MCQ practice." },
      { property: "og:title", content: "My Syllabus — Testified" },
      { property: "og:description", content: "Pick the topics in your school exam for mixed MCQ practice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SyllabusPicker,
});

type Topic = { id: string; name: string };
type Chapter = { id: string; name: string; position: number; topics: Topic[] };

function SyllabusPicker() {
  const { subjectId } = Route.useParams();
  const navigate = useNavigate();
  const [subjectName, setSubjectName] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(MIXED_MIN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const [{ data: s }, { data: chs }, { data: syl }] = await Promise.all([
        supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
        supabase.from("chapters").select("id, name, position").eq("subject_id", subjectId).order("position"),
        supabase.from("student_syllabus").select("topic_ids, question_count")
          .eq("subject_id", subjectId).eq("user_id", u.user?.id ?? "").maybeSingle(),
      ]);
      setSubjectName(s?.name ?? "");
      const chIds = (chs ?? []).map((c) => c.id);
      const { data: tps } = chIds.length
        ? await supabase.from("topics").select("id, name, chapter_id, position").in("chapter_id", chIds).order("position")
        : { data: [] as any[] };
      setChapters((chs ?? []).map((c) => ({
        ...c,
        topics: (tps ?? []).filter((t: any) => t.chapter_id === c.id).map((t: any) => ({ id: t.id, name: t.name })),
      })));
      if (syl) {
        setPicked(new Set(syl.topic_ids ?? []));
        setCount(syl.question_count === MIXED_MAX ? MIXED_MAX : MIXED_MIN);
      }
      setLoading(false);
    })();
  }, [subjectId]);

  const toggle = (id: string) =>
    setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleChapter = (c: Chapter) =>
    setPicked((p) => {
      const n = new Set(p);
      const all = c.topics.every((t) => n.has(t.id));
      c.topics.forEach((t) => (all ? n.delete(t.id) : n.add(t.id)));
      return n;
    });

  const selected = useMemo(() => picked.size, [picked]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("student_syllabus").upsert(
      { user_id: u.user!.id, subject_id: subjectId, topic_ids: [...picked], question_count: count },
      { onConflict: "user_id,subject_id" },
    );
    setSaving(false);
    if (error) { toast.error("Could not save. Please try again."); return; }
    toast.success("Syllabus saved");
    navigate({ to: "/practice/topic/$topicId", params: { topicId: MIXED_PREFIX + subjectId } });
  };

  return (
    <div className="min-h-screen pb-32">
      <AppHeader back={{ to: "/subject/$id", params: { id: subjectId } }} />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Select your exam syllabus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {subjectName ? `${subjectName} · ` : ""}Tap the topics that are in your school exam.
        </p>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : chapters.length === 0 ? (
          <div className="mt-6 glass rounded-3xl p-8 text-center text-sm text-muted-foreground">No topics yet.</div>
        ) : (
          <div className="mt-6 space-y-6">
            {chapters.map((c) => {
              if (!c.topics.length) return null;
              const all = c.topics.every((t) => picked.has(t.id));
              return (
                <section key={c.id}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-sm font-semibold">{c.position}. {c.name}</h2>
                    <button onClick={() => toggleChapter(c)} className="text-xs font-medium text-primary shrink-0">
                      {all ? "Clear" : "Select all"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {c.topics.map((t) => {
                      const on = picked.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggle(t.id)}
                          aria-pressed={on}
                          className={`w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-all ${on ? "ring-2 ring-primary/70" : "opacity-80"}`}
                        >
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${on ? "btn-gradient" : "border border-border"}`}>
                            {on && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="text-sm flex-1">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
        <div className="mx-auto max-w-2xl glass-strong rounded-3xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{selected} topic{selected === 1 ? "" : "s"} selected</div>
            <div className="mt-1 flex gap-1.5">
              {[MIXED_MIN, MIXED_MAX].map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  className={`text-xs rounded-full px-2.5 py-0.5 ${count === n ? "btn-gradient" : "glass"}`}>
                  {n} MCQs
                </button>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={!selected || saving}
            className="btn-gradient rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40">
            {saving ? "Saving…" : "Save & Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
