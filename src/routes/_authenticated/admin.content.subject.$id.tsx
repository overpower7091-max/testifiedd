import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ArrowRight, ChevronDown, Layers } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/content/subject/$id")({
  head: () => ({ meta: [{ title: "Manage subject — Admin" }] }),
  component: ManageSubject,
});

function ManageSubject() {
  const { id } = Route.useParams();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState("");
  const [newTopic, setNewTopic] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("subjects").select("id, name").eq("id", id).maybeSingle();
    setSubject(s);
    const { data: chs } = await supabase.from("chapters").select("id, name, position").eq("subject_id", id).order("position");
    const enriched = await Promise.all((chs ?? []).map(async (c: any) => {
      const { data: topics } = await supabase.from("topics").select("id, name, position").eq("chapter_id", c.id).order("position");
      const topicRows = await Promise.all((topics ?? []).map(async (t: any) => {
        const { data: banks } = await supabase.from("question_banks").select("id").eq("topic_id", t.id);
        const bankIds = (banks ?? []).map((b: any) => b.id);
        let qCount = 0;
        if (bankIds.length) {
          const { count } = await supabase.from("questions").select("*", { count: "exact", head: true }).in("question_bank_id", bankIds);
          qCount = count ?? 0;
        }
        return { ...t, qCount };
      }));
      return { ...c, topics: topicRows };
    }));
    setChapters(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const addChapter = async () => {
    const name = newChapter.trim();
    if (!name) return;
    const pos = (chapters[chapters.length - 1]?.position ?? 0) + 1;
    const { error } = await supabase.from("chapters").insert({ subject_id: id, name, position: pos });
    if (error) return toast.error(error.message);
    toast.success("Section added"); setNewChapter(""); load();
  };

  const removeChapter = async (cid: string) => {
    if (!confirm("Delete this section and all its subtopics/questions?")) return;
    const { error } = await supabase.from("chapters").delete().eq("id", cid);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const addTopic = async (cid: string) => {
    const name = (newTopic[cid] || "").trim();
    if (!name) return;
    const c = chapters.find((x) => x.id === cid);
    const pos = (c?.topics[c.topics.length - 1]?.position ?? 0) + 1;
    const { data, error } = await supabase.from("topics").insert({ chapter_id: cid, name, position: pos }).select("id").maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Failed");
    await supabase.from("question_banks").insert({ topic_id: data.id, name: "Default Bank" });
    toast.success("Subtopic added"); setNewTopic((s) => ({ ...s, [cid]: "" })); load();
  };

  const removeTopic = async (tid: string) => {
    if (!confirm("Delete this subtopic and all its questions?")) return;
    const { error } = await supabase.from("topics").delete().eq("id", tid);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin/content" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Manage subject</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">{subject?.name ?? "…"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add sections (chapters) and subtopics. Click a subtopic to manage its MCQs.</p>
        </div>

        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <input value={newChapter} onChange={(e) => setNewChapter(e.target.value)} placeholder="New section name (e.g. ভৌত পরিবেশ)"
              className="flex-1 glass-tint rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <button onClick={addChapter} className="btn-gradient rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add section</button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : chapters.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">No sections yet.</div>
        ) : chapters.map((c) => {
          const isOpen = open === c.id;
          return (
            <div key={c.id} className="glass rounded-3xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 sm:p-5">
                <button onClick={() => setOpen(isOpen ? null : c.id)} className="flex items-center gap-3 flex-1 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tint text-primary"><Layers className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Section {c.position}. {c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.topics.length} subtopics</div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => removeChapter(c.id)} className="glass-tint rounded-full p-2 text-red-500 hover:scale-105 transition-transform"><Trash2 className="h-4 w-4" /></button>
              </div>
              {isOpen && (
                <div className="px-3 sm:px-5 pb-5 space-y-2">
                  {c.topics.map((t: any) => (
                    <div key={t.id} className="glass-tint rounded-2xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.qCount} questions</div>
                      </div>
                      <Link to="/admin/content/topic/$id" params={{ id: t.id }} className="btn-gradient rounded-full px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1">MCQs <ArrowRight className="h-3 w-3" /></Link>
                      <button onClick={() => removeTopic(t.id)} className="glass rounded-full p-2 text-red-500 hover:scale-105 transition-transform"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      value={newTopic[c.id] ?? ""}
                      onChange={(e) => setNewTopic((s) => ({ ...s, [c.id]: e.target.value }))}
                      placeholder="New subtopic name"
                      className="flex-1 glass rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                    <button onClick={() => addTopic(c.id)} className="glass rounded-full px-3 py-2 text-xs font-medium inline-flex items-center gap-1 hover:text-primary"><Plus className="h-3.5 w-3.5" /> Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
