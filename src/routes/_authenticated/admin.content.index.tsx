import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, BookOpen, ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/content/")({
  head: () => ({ meta: [{ title: "Content — Admin" }] }),
  component: ContentHome,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/^-+|-+$/g, "") || `subject-${Date.now()}`;

function ContentHome() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubject, setNewSubject] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("classes")
      .select("id, level, subjects(id, name, position)")
      .order("level");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addSubject = async (classId: string, existing: any[]) => {
    const name = (newSubject[classId] || "").trim();
    if (!name) return;
    setBusy(classId);
    const pos = (existing.map((s) => s.position ?? 0).sort((a, b) => a - b).pop() ?? 0) + 1;
    const { error } = await supabase
      .from("subjects")
      .insert({ class_id: classId, name, slug: slugify(name), position: pos });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Subject added");
    setNewSubject((s) => ({ ...s, [classId]: "" }));
    load();
  };

  const removeSubject = async (subjectId: string) => {
    if (!confirm("Delete this subject and everything inside it?")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Content manager</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Manage <span className="gradient-text">questions</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Add subjects to a class, then open a subject to build sections, subtopics and MCQs.</p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((c) => {
              const subjects = (c.subjects ?? []).slice().sort((a: any, b: any) => a.position - b.position);
              return (
                <div key={c.id} className="glass rounded-3xl p-5">
                  <div className="text-sm font-semibold">Class {c.level}</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {subjects.map((s: any) => (
                      <div key={s.id} className="group glass-tint rounded-2xl p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl glass text-primary"><BookOpen className="h-5 w-5" /></div>
                        <Link to="/admin/content/subject/$id" params={{ id: s.id }} className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground">Manage content</div>
                        </Link>
                        <Link to="/admin/content/subject/$id" params={{ id: s.id }} className="text-muted-foreground hover:text-primary transition-colors">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <button onClick={() => removeSubject(s.id)} className="glass rounded-full p-2 text-red-500 hover:scale-105 transition-transform">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={newSubject[c.id] ?? ""}
                      onChange={(e) => setNewSubject((s) => ({ ...s, [c.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addSubject(c.id, subjects); }}
                      placeholder={`New subject for class ${c.level}`}
                      className="flex-1 glass-tint rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      onClick={() => addSubject(c.id, subjects)}
                      disabled={busy === c.id}
                      className="btn-gradient rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-60"
                    >
                      {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add subject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
