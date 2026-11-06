CREATE TABLE public.student_syllabus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_ids uuid[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_syllabus TO authenticated;
GRANT ALL ON public.student_syllabus TO service_role;
ALTER TABLE public.student_syllabus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own syllabus select" ON public.student_syllabus FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own syllabus insert" ON public.student_syllabus FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own syllabus update" ON public.student_syllabus FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own syllabus delete" ON public.student_syllabus FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER student_syllabus_updated_at BEFORE UPDATE ON public.student_syllabus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();