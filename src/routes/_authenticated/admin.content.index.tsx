import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, BookOpen, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/content/")({
  head: () => ({ meta: [{ title: "Content — Admin" }] }),
  component: ContentHome,
});

function ContentHome() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, level, subjects(id, name, position)")
        .order("level");
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Content manager</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Manage <span className="gradient-text">questions</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick a class, then a subject to edit sections, subtopics and MCQs.</p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((c) => (
              <div key={c.id} className="glass rounded-3xl p-5">
                <div className="text-sm font-semibold">Class {c.level}</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(c.subjects ?? []).sort((a: any, b: any) => a.position - b.position).map((s: any) => (
                    <Link key={s.id} to="/admin/content/subject/$id" params={{ id: s.id }} className="group glass-tint rounded-2xl p-4 flex items-center gap-3 hover:scale-[1.01] transition-transform">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl glass text-primary"><BookOpen className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">Manage content</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
