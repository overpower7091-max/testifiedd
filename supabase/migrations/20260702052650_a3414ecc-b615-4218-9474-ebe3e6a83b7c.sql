
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
CREATE POLICY "profiles_admin_update_all" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  selected_index integer,
  is_correct boolean NOT NULL DEFAULT false,
  time_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts_own_read" ON public.quiz_attempts;
DROP POLICY IF EXISTS "attempts_own_insert" ON public.quiz_attempts;
DROP POLICY IF EXISTS "attempts_admin_read" ON public.quiz_attempts;
CREATE POLICY "attempts_own_read" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "attempts_own_insert" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_admin_read" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS quiz_attempts_user_created_idx ON public.quiz_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_subject_idx ON public.quiz_attempts(user_id, subject_id);

DO $seed$
DECLARE
  s RECORD;
  ch_id uuid; tp_id uuid; bank_id uuid;
  chap_names text[] := ARRAY['Introduction & Basics', 'Core Concepts', 'Advanced Problems'];
  i int; q int;
BEGIN
  FOR s IN SELECT id, name FROM public.subjects LOOP
    FOR i IN 1..3 LOOP
      SELECT id INTO ch_id FROM public.chapters WHERE subject_id = s.id AND name = chap_names[i] LIMIT 1;
      IF ch_id IS NULL THEN
        INSERT INTO public.chapters(subject_id, name, position) VALUES (s.id, chap_names[i], i) RETURNING id INTO ch_id;
      END IF;

      SELECT id INTO tp_id FROM public.topics WHERE chapter_id = ch_id LIMIT 1;
      IF tp_id IS NULL THEN
        INSERT INTO public.topics(chapter_id, name, position) VALUES (ch_id, 'General', 1) RETURNING id INTO tp_id;
      END IF;

      SELECT id INTO bank_id FROM public.question_banks WHERE topic_id = tp_id LIMIT 1;
      IF bank_id IS NULL THEN
        INSERT INTO public.question_banks(topic_id, name) VALUES (tp_id, 'Practice Bank') RETURNING id INTO bank_id;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.questions WHERE question_bank_id = bank_id) THEN
        FOR q IN 1..5 LOOP
          INSERT INTO public.questions(question_bank_id, type, question, options, correct_answer, explanation, difficulty)
          VALUES (
            bank_id, 'single',
            s.name || ' — ' || chap_names[i] || ' — Sample Q' || q || ': Which option is correct?',
            jsonb_build_array('Option A', 'Option B (correct)', 'Option C', 'Option D'),
            to_jsonb(1),
            'Option B is the correct answer. Admin can replace seed content with real questions.',
            (ARRAY['easy','medium','hard'])[1 + ((q-1) % 3)]::difficulty
          );
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END;
$seed$;
