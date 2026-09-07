import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SubjectCard } from "@/components/subject-card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({ meta: [{ title: "Subjects — Testified" }] }),
  component: Subjects,
});


function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("class").eq("id", userRes.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userRes.user.id),
      ]);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      if (!p?.class) { setLoading(false); return; }
      setLevel(p.class);
      const { data: cls } = await supabase.from("classes").select("id").eq("level", p.class).maybeSingle();
      if (!cls) { setLoading(false); return; }
      const { data: subs } = await supabase
        .from("subjects").select("id, name").eq("class_id", cls.id).order("position");
      const enriched = await Promise.all((subs ?? []).map(async (s: any) => {
        const [{ count: chapCount }, { data: att }] = await Promise.all([
          supabase.from("chapters").select("*", { count: "exact", head: true }).eq("subject_id", s.id),
          supabase.from("quiz_attempts").select("is_correct").eq("user_id", userRes.user!.id).eq("subject_id", s.id),
        ]);
        const total = att?.length ?? 0;
        const correct = att?.filter((a: any) => a.is_correct).length ?? 0;
        return { ...s, chapters: chapCount ?? 0, attempts: total, accuracy: total ? Math.round((correct / total) * 100) : 0 };
      }));
      setSubjects(enriched);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin={isAdmin} back={{ to: "/home" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Class {level || "—"}</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Pick a <span className="gradient-text">subject</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Practice MCQs chapter by chapter.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : subjects.length === 0 ? (
            <div className="col-span-full glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
              No subjects available for your class yet.
            </div>
          ) : subjects.map((s) => (
            <SubjectCard
              key={s.id}
              id={s.id}
              name={s.name}
              chapters={s.chapters}
              attempts={s.attempts}
              accuracy={s.accuracy}
              className="min-h-[190px]"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
