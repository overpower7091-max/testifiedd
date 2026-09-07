import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, PlayCircle, ArrowRight, ChevronDown, Layers } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/subject/$id")({
  head: () => ({ meta: [{ title: "Chapters — Testified" }] }),
  component: SubjectDetail,
});

type Topic = { id: string; name: string; qCount: number; attempts: number; correct: number };
type Chapter = { id: string; name: string; position: number; topics: Topic[] };

function SubjectDetail() {
  const { id } = Route.useParams();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const [{ data: s }, { data: chs }, { data: roles }] = await Promise.all([
        supabase.from("subjects").select("id, name").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("id, name, position").eq("subject_id", id).order("position"),
        userRes.user ? supabase.from("user_roles").select("role").eq("user_id", userRes.user.id) : Promise.resolve({ data: [] } as any),
      ]);
      setSubject(s);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));

      const enriched: Chapter[] = await Promise.all((chs ?? []).map(async (c: any) => {
        const { data: topics } = await supabase.from("topics").select("id, name, position").eq("chapter_id", c.id).order("position");
        const enrichedTopics: Topic[] = await Promise.all((topics ?? []).map(async (t: any) => {
          const { data: banks } = await supabase.from("question_banks").select("id").eq("topic_id", t.id);
          const bankIds = (banks ?? []).map((b: any) => b.id);
          let qCount = 0;
          if (bankIds.length) {
            const { count } = await supabase.from("questions").select("*", { count: "exact", head: true }).in("question_bank_id", bankIds);
            qCount = count ?? 0;
          }
          let attempts = 0, correct = 0;
          if (userRes.user) {
            // approximate per-topic via joining questions — cheap approximation: none stored; skip
          }
          return { id: t.id, name: t.name, qCount, attempts, correct };
        }));
        return { id: c.id, name: c.name, position: c.position, topics: enrichedTopics };
      }));
      setChapters(enriched);
      if (enriched.length) setOpen(enriched[0].id);
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin={isAdmin} back={{ to: "/subjects" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Subject</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">{subject?.name ?? "…"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Expand a section and pick a subtopic to start a 10-question randomized quiz.</p>
          {isAdmin && subject && (
            <Link to="/admin/content/subject/$id" params={{ id: subject.id }} className="mt-4 inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium hover:text-primary">
              Manage content <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : chapters.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">No sections yet.</div>
          ) : chapters.map((c) => {
            const isOpen = open === c.id;
            const totalQ = c.topics.reduce((s, t) => s + t.qCount, 0);
            return (
              <div key={c.id} className="glass rounded-3xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : c.id)}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 text-left"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl glass-tint text-primary shrink-0">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Section {c.position}. {c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.topics.length} subtopics · {totalQ} questions</div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-3 sm:px-4 pb-4 space-y-2">
                    {c.topics.length === 0 ? (
                      <div className="glass-tint rounded-2xl p-4 text-xs text-muted-foreground">No subtopics yet.</div>
                    ) : c.topics.map((t) => (
                      <div key={t.id} className="glass rounded-2xl p-3 sm:p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.qCount} questions available</div>
                        </div>
                        <Link
                          to="/practice/topic/$topicId"
                          params={{ topicId: t.id }}
                          className="btn-gradient rounded-full inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium"
                        >
                          <PlayCircle className="h-3.5 w-3.5" /> Practice
                        </Link>
                      </div>
                    ))}
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
