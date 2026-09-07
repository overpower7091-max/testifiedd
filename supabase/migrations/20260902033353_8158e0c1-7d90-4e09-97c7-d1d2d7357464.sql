CREATE TABLE public.question_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'practice',
  quiz_attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  live_quiz_id UUID REFERENCES public.live_quizzes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  admin_note TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.question_reports TO authenticated;
GRANT ALL ON public.question_reports TO service_role;
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own question reports" ON public.question_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can submit question reports" ON public.question_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins can moderate question reports" ON public.question_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX question_reports_status_created_idx ON public.question_reports(status, created_at DESC);
CREATE INDEX question_reports_question_idx ON public.question_reports(question_id, created_at DESC);
CREATE TRIGGER question_reports_set_updated_at
  BEFORE UPDATE ON public.question_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Live quiz questions readable" ON public.live_quiz_questions;
CREATE POLICY "Live quiz questions readable" ON public.live_quiz_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_quizzes q
      WHERE q.id = live_quiz_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR (
            q.class_level = (SELECT class FROM public.profiles WHERE id = auth.uid())
            AND q.status IN ('live', 'ended')
          )
        )
    )
  );