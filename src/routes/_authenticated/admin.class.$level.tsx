import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Search, ShieldAlert, ArrowRight, User } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/class/$level")({
  head: () => ({ meta: [{ title: "Class — Admin" }] }),
  component: ClassStudents,
});

type Row = { id: string; full_name: string | null; xp: number; streak: number; is_banned: boolean; created_at: string };

function ClassStudents() {
  const { level } = Route.useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, xp, streak, is_banned, created_at")
        .eq("class", level as any)
        .order("xp", { ascending: false });
      setRows((data ?? []) as any);
      setLoading(false);
    })();
  }, [level]);

  const filtered = rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Class {level}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            <span className="gradient-text">{rows.length}</span> students enrolled
          </h1>
          <div className="mt-5 glass rounded-full flex items-center gap-2 px-4 py-2 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mt-6 glass rounded-3xl p-3 sm:p-4">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No students found.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((s) => (
                <Link
                  key={s.id}
                  to="/admin/student/$id"
                  params={{ id: s.id }}
                  className="flex items-center gap-3 sm:gap-4 px-3 py-3 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full glass-tint text-primary shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{s.full_name || "Unnamed student"}</div>
                      {s.is_banned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-medium">
                          <ShieldAlert className="h-3 w-3" /> Suspended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">Joined {new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    <span><b className="text-foreground">{s.xp}</b> XP</span>
                    <span><b className="text-foreground">{s.streak}</b>d streak</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
