ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quiz_attempts_session_idx ON public.quiz_attempts(user_id, session_id, created_at);