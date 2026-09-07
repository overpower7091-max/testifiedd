
-- =========================================================
-- LIVE QUIZ MODULE — Full Schema
-- =========================================================

-- ---- Blueprints ----
CREATE TABLE public.live_quiz_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_level public.class_level NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  questions_total INT NOT NULL DEFAULT 10,
  question_seconds INT NOT NULL DEFAULT 90,
  difficulty_easy INT NOT NULL DEFAULT 4,
  difficulty_medium INT NOT NULL DEFAULT 4,
  difficulty_hard INT NOT NULL DEFAULT 2,
  lookback_weeks INT NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_level, subject_id)
);
GRANT SELECT ON public.live_quiz_blueprints TO authenticated;
GRANT ALL ON public.live_quiz_blueprints TO service_role;
ALTER TABLE public.live_quiz_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blueprints readable by authenticated" ON public.live_quiz_blueprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage blueprints" ON public.live_quiz_blueprints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.live_quiz_blueprint_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blueprint_id UUID NOT NULL REFERENCES public.live_quiz_blueprints(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  question_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, topic_id)
);
GRANT SELECT ON public.live_quiz_blueprint_topics TO authenticated;
GRANT ALL ON public.live_quiz_blueprint_topics TO service_role;
ALTER TABLE public.live_quiz_blueprint_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blueprint topics readable" ON public.live_quiz_blueprint_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage blueprint topics" ON public.live_quiz_blueprint_topics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.live_quiz_blueprint_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blueprint_id UUID NOT NULL REFERENCES public.live_quiz_blueprints(id) ON DELETE CASCADE,
  class_level public.class_level NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_quiz_blueprint_versions TO authenticated;
GRANT ALL ON public.live_quiz_blueprint_versions TO service_role;
ALTER TABLE public.live_quiz_blueprint_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Versions readable" ON public.live_quiz_blueprint_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert versions" ON public.live_quiz_blueprint_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---- Live Quizzes ----
CREATE TYPE public.live_quiz_status AS ENUM ('scheduled','configuration_required','generating','live','ended','cancelled');

CREATE TABLE public.live_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_level public.class_level NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.live_quiz_status NOT NULL DEFAULT 'scheduled',
  blueprint_version_id UUID REFERENCES public.live_quiz_blueprint_versions(id) ON DELETE SET NULL,
  questions_total INT NOT NULL DEFAULT 10,
  question_seconds INT NOT NULL DEFAULT 90,
  current_question_index INT NOT NULL DEFAULT 0,
  current_question_start_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_level, subject_id, scheduled_at)
);
CREATE INDEX idx_live_quizzes_status ON public.live_quizzes(status, scheduled_at);
CREATE INDEX idx_live_quizzes_class ON public.live_quizzes(class_level, scheduled_at DESC);
GRANT SELECT ON public.live_quizzes TO authenticated;
GRANT ALL ON public.live_quizzes TO service_role;
ALTER TABLE public.live_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live quizzes readable by class" ON public.live_quizzes FOR SELECT TO authenticated USING (
  class_level = (SELECT class FROM public.profiles WHERE id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Admins manage live quizzes" ON public.live_quizzes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.live_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  difficulty public.difficulty NOT NULL DEFAULT 'medium',
  UNIQUE (live_quiz_id, position),
  UNIQUE (live_quiz_id, question_id)
);
GRANT SELECT ON public.live_quiz_questions TO authenticated;
GRANT ALL ON public.live_quiz_questions TO service_role;
ALTER TABLE public.live_quiz_questions ENABLE ROW LEVEL SECURITY;
-- Students can read questions of quizzes for their class that are live/ended, up to the current position when live
CREATE POLICY "Live quiz questions readable" ON public.live_quiz_questions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.live_quizzes q
    WHERE q.id = live_quiz_id
      AND (public.has_role(auth.uid(),'admin')
        OR (q.class_level = (SELECT class FROM public.profiles WHERE id = auth.uid())
            AND q.status IN ('live','ended')
            AND (q.status = 'ended' OR position <= q.current_question_index)))
  )
);

-- ---- Participants ----
CREATE TABLE public.live_quiz_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  total_time_ms BIGINT NOT NULL DEFAULT 0,
  last_submit_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  rank INT,
  UNIQUE (live_quiz_id, user_id)
);
CREATE INDEX idx_lq_participants_quiz ON public.live_quiz_participants(live_quiz_id, score DESC, total_time_ms ASC);
GRANT SELECT ON public.live_quiz_participants TO authenticated;
GRANT ALL ON public.live_quiz_participants TO service_role;
ALTER TABLE public.live_quiz_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants readable by class" ON public.live_quiz_participants FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.live_quizzes q WHERE q.id = live_quiz_id AND (
    public.has_role(auth.uid(),'admin')
    OR q.class_level = (SELECT class FROM public.profiles WHERE id = auth.uid())
  ))
);

CREATE TABLE public.live_quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_quiz_id UUID NOT NULL REFERENCES public.live_quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_index INT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  response_ms INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_quiz_id, user_id, position)
);
CREATE INDEX idx_lq_answers_user ON public.live_quiz_answers(user_id, live_quiz_id);
GRANT SELECT ON public.live_quiz_answers TO authenticated;
GRANT ALL ON public.live_quiz_answers TO service_role;
ALTER TABLE public.live_quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own answers readable" ON public.live_quiz_answers FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- ---- Streaks ----
CREATE TABLE public.live_quiz_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_level public.class_level NOT NULL,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  total_attempted INT NOT NULL DEFAULT 0,
  last_participated_on DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_level)
);
GRANT SELECT ON public.live_quiz_streaks TO authenticated;
GRANT ALL ON public.live_quiz_streaks TO service_role;
ALTER TABLE public.live_quiz_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own streaks readable" ON public.live_quiz_streaks FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- ---- XP ----
CREATE TABLE public.xp_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount INT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_history_user ON public.xp_history(user_id, created_at DESC);
GRANT SELECT ON public.xp_history TO authenticated;
GRANT ALL ON public.xp_history TO service_role;
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own xp readable" ON public.xp_history FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- ---- Achievements ----
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements catalog readable" ON public.achievements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  ref_id UUID,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id, ref_id)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own achievements readable" ON public.user_achievements FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- ---- updated_at triggers ----
CREATE TRIGGER trg_lq_blueprints_updated BEFORE UPDATE ON public.live_quiz_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_live_quizzes_updated BEFORE UPDATE ON public.live_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lq_streaks_updated BEFORE UPDATE ON public.live_quiz_streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Seed achievement catalog ----
INSERT INTO public.achievements (code, name, description, icon) VALUES
 ('champion', 'Champion', 'Ranked #1 in a live quiz', 'trophy'),
 ('top10', 'Top 10', 'Finished in the top 10 of a live quiz', 'medal'),
 ('top100', 'Top 100', 'Finished in the top 100 of a live quiz', 'award'),
 ('perfect_score', 'Perfect Score', 'Answered every question correctly', 'star'),
 ('streak_7', '7-Day Streak', 'Attended 7 live quizzes in a row', 'flame')
ON CONFLICT (code) DO NOTHING;

-- ---- Realtime ----
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_participants;
