import { useState } from "react";
import { Flag, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ReportQuestionDialogProps = {
  questionId: string;
  source: "practice" | "history" | "live";
  quizAttemptId?: string | null;
  liveQuizId?: string | null;
  className?: string;
  onSubmitted?: () => void;
};

export function ReportQuestionDialog({
  questionId,
  source,
  quizAttemptId = null,
  liveQuizId = null,
  className = "",
  onSubmitted,
}: ReportQuestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const reportText = text.trim();
    if (reportText.length < 8) {
      toast.error("Please describe what seems wrong with this question.");
      return;
    }
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      toast.error("Sign in to report a question.");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("question_reports").insert({
      question_id: questionId,
      reporter_id: userRes.user.id,
      report_text: reportText,
      source,
      quiz_attempt_id: quizAttemptId,
      live_quiz_id: liveQuizId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not submit report");
      return;
    }
    toast.success("Thanks — your report was sent to the admin team.");
    setText("");
    setOpen(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-warning ${className}`}>
          <Flag className="h-3.5 w-3.5" /> Report question
        </button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this question</DialogTitle>
          <DialogDescription>
            Tell the admin team what is incorrect, unclear, or missing. Your note helps us improve the question bank.
          </DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="For example: option B is not correct because…"
          maxLength={1000}
          className="min-h-32 w-full resize-y rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
        />
        <div className="text-right text-[11px] text-muted-foreground">{text.length}/1000</div>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className="glass rounded-full px-4 py-2 text-sm font-medium">Cancel</button>
          <button type="button" onClick={submit} disabled={submitting} className="btn-gradient inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send report
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}