import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, ArrowRight, Loader2, FileText, Flag } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Testified" }] }),
  component: AdminHome,
});

const LEVELS = ["6", "7", "8", "9", "10", "11", "12"] as const;

function AdminHome() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [banned, setBanned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("class, is_banned");
      const map: Record<string, number> = {};
      let b = 0;
      (data ?? []).forEach((p: any) => {
        if (p.class) map[p.class] = (map[p.class] ?? 0) + 1;
        if (p.is_banned) b++;
      });
      setCounts(map);
      setTotal(data?.length ?? 0);
      setBanned(b);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/home" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Admin panel</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Manage <span className="gradient-text">students</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Select a class to view enrolled students, inspect their profile, or restrict access.</p>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Total students" value={loading ? "…" : String(total)} />
            <Metric label="Active" value={loading ? "…" : String(total - banned)} />
            <Metric label="Suspended" value={loading ? "…" : String(banned)} />
            <Metric label="Classes" value="6–12" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/admin/content" className="btn-gradient rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
              <FileText className="h-4 w-4" /> Manage content & MCQs
            </Link>
            <Link to="/admin/live-quiz" className="rounded-full glass px-4 py-2 text-sm font-medium inline-flex items-center gap-2 hover:text-primary">
              <FileText className="h-4 w-4" /> Live Quiz Configuration
            </Link>
            <Link to="/admin/reports" className="rounded-full glass px-4 py-2 text-sm font-medium inline-flex items-center gap-2 hover:text-primary">
              <Flag className="h-4 w-4" /> Question reports
            </Link>
          </div>
        </div>

        <div className="mt-6 glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold">Classes</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {LEVELS.map((lv) => (
              <Link
                key={lv}
                to="/admin/class/$level"
                params={{ level: lv }}
                className="group glass rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tint text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Class {lv}</div>
                  <div className="text-xs text-muted-foreground">
                    {loading ? <Loader2 className="h-3 w-3 inline animate-spin" /> : `${counts[lv] ?? 0} students`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-semibold gradient-text">{value}</div>
    </div>
  );
}
