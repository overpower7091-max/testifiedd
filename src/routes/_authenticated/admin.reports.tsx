import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Flag, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Latex } from "@/components/latex";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Question reports — Admin" }] }),
  component: ReportsPage,
});

type Report = {
  id: string;
  question_id: string;
  report_text: string;
  source: string;
  status: "open" | "resolved" | "dismissed";
  admin_note: string | null;
  created_at: string;
  reporter_id: string;
  question: {
    id: string;
    question: string;
    options: string[];
    correct_answer: number;
    explanation: string | null;
    difficulty: string;
  } | null;
  reporter: { full_name: string | null } | null;
};

type EditState = {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: string;
};

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const query = supabase.from("question_reports")
      .select("id, question_id, report_text, source, status, admin_note, created_at, reporter_id, questions(id, question, options, correct_answer, explanation, difficulty)")
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as any[];
    const reporterIds = [...new Set(rows.map((row) => row.reporter_id).filter(Boolean))];
    const { data: profiles } = reporterIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", reporterIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    const normalized = rows.map((row) => ({
      ...row,
      question: Array.isArray(row.questions) ? row.questions[0] ?? null : row.questions ?? null,
      reporter: profileMap.get(row.reporter_id) ?? null,
    })) as Report[];
    setReports(normalized);
    setNotes(Object.fromEntries(normalized.map((row) => [row.id, row.admin_note ?? ""])));
    setEditing(Object.fromEntries(normalized.filter((row) => row.question).map((row) => [row.id, toEditState(row.question)])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === "all" ? reports : reports.filter((report) => report.status === filter), [filter, reports]);

  const saveQuestion = async (report: Report) => {
    const draft = editing[report.id];
    if (!draft || !draft.question.trim() || draft.options.some((option) => !option.trim())) {
      toast.error("Fill the question and all answer options.");
      return;
    }
    setSaving(report.id);
    const { error } = await supabase.from("questions").update({
      question: draft.question.trim(),
      options: draft.options,
      correct_answer: draft.correct_answer,
      explanation: draft.explanation.trim() || null,
      difficulty: draft.difficulty as any,
    }).eq("id", report.question_id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Question updated");
    await updateStatus(report, "resolved", "Question corrected by admin");
  };

  const updateStatus = async (report: Report, status: Report["status"], fallbackNote?: string) => {
    setSaving(report.id);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("question_reports").update({
      status,
      admin_note: notes[report.id]?.trim() || fallbackNote || null,
      resolved_by: status === "open" ? null : userRes.user?.id ?? null,
      resolved_at: status === "open" ? null : new Date().toISOString(),
    }).eq("id", report.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(status === "resolved" ? "Report resolved" : status === "dismissed" ? "Report dismissed" : "Report reopened");
    await load();
  };

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Admin moderation</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Question <span className="gradient-text">reports</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Review student feedback, correct faulty MCQs, and keep a clear moderation history.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(["open", "resolved", "dismissed", "all"] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-xs font-medium capitalize ${filter === value ? "btn-gradient text-white" : "glass hover:text-primary"}`}>
                {value} ({value === "all" ? reports.length : reports.filter((report) => report.status === value).length})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : visible.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground"><Flag className="mx-auto h-7 w-7 mb-3" />No {filter === "all" ? "question reports" : `${filter} reports`}.</div>
          ) : visible.map((report) => {
            const open = expanded === report.id;
            const draft = editing[report.id];
            return (
              <section key={report.id} className="glass rounded-3xl overflow-hidden">
                <button onClick={() => setExpanded(open ? null : report.id)} className="w-full p-5 text-left flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl glass-tint text-warning"><Flag className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-semibold ${report.status === "open" ? "bg-warning/15 text-warning" : report.status === "resolved" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{report.status}</span>
                      <span className="text-[11px] text-muted-foreground">{report.source} · {new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium line-clamp-2">{report.question?.question ?? "Question unavailable"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Reported by {report.reporter?.full_name || "Student"}</div>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {open && draft && (
                  <div className="border-t border-border/60 p-5 space-y-4">
                    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm"><div className="text-[10px] uppercase tracking-widest text-warning font-semibold">Student report</div><p className="mt-2 whitespace-pre-wrap">{report.report_text}</p></div>
                    <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                      <div className="space-y-3">
                        <textarea value={draft.question} onChange={(event) => setDraft(report.id, { question: event.target.value })} className="w-full min-h-24 glass-tint rounded-xl px-3 py-2 text-sm outline-none" />
                        {draft.options.map((option, index) => <div key={index} className="flex items-center gap-2"><button onClick={() => setDraft(report.id, { correct_answer: index })} className={`h-7 w-7 rounded-full text-xs font-semibold ${draft.correct_answer === index ? "btn-gradient" : "glass-tint text-primary"}`}>{String.fromCharCode(65 + index)}</button><input value={option} onChange={(event) => setOption(report.id, index, event.target.value)} className="flex-1 glass-tint rounded-xl px-3 py-2 text-sm outline-none" /></div>)}
                        <textarea value={draft.explanation} onChange={(event) => setDraft(report.id, { explanation: event.target.value })} placeholder="Explanation" className="w-full min-h-20 glass-tint rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                      <div className="space-y-3"><div className="glass-tint rounded-2xl p-4"><div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Preview</div><div className="mt-3 text-sm font-medium"><Latex>{draft.question}</Latex></div><div className="mt-3 space-y-1.5">{draft.options.map((option, index) => <div key={index} className={`rounded-xl px-3 py-2 text-xs glass ${index === draft.correct_answer ? "ring-1 ring-success/50" : ""}`}><b>{String.fromCharCode(65 + index)}.</b> <Latex>{option}</Latex></div>)}</div></div><select value={draft.difficulty} onChange={(event) => setDraft(report.id, { difficulty: event.target.value })} className="w-full glass rounded-xl px-3 py-2 text-sm bg-card"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                    </div>
                    <textarea value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Admin note" className="w-full min-h-16 glass-tint rounded-xl px-3 py-2 text-sm outline-none" />
                    <div className="flex flex-wrap justify-end gap-2"><button onClick={() => updateStatus(report, "dismissed")} disabled={saving === report.id} className="glass rounded-full px-4 py-2 text-sm inline-flex items-center gap-2"><X className="h-4 w-4" /> Dismiss</button><button onClick={() => updateStatus(report, "open")} disabled={saving === report.id || report.status === "open"} className="glass rounded-full px-4 py-2 text-sm inline-flex items-center gap-2"><Flag className="h-4 w-4" /> Reopen</button><button onClick={() => saveQuestion(report)} disabled={saving === report.id} className="btn-gradient rounded-full px-4 py-2 text-sm inline-flex items-center gap-2">{saving === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & resolve</button><button onClick={() => updateStatus(report, "resolved")} disabled={saving === report.id} className="rounded-full bg-success px-4 py-2 text-sm text-success-foreground inline-flex items-center gap-2"><Check className="h-4 w-4" /> Resolve</button></div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );

  function setDraft(id: string, patch: Partial<EditState>) { setEditing((current) => ({ ...current, [id]: { ...current[id], ...patch } })); }
  function setOption(id: string, index: number, value: string) { setEditing((current) => { const currentDraft = current[id]; if (!currentDraft) return current; const options = [...currentDraft.options]; options[index] = value; return { ...current, [id]: { ...currentDraft, options } }; }); }
}

function toEditState(question: NonNullable<Report["question"]>): EditState {
  return { question: question.question, options: Array.isArray(question.options) ? question.options : [], correct_answer: Number(question.correct_answer ?? 0), explanation: question.explanation ?? "", difficulty: question.difficulty };
}