-- Enums
CREATE TYPE public.app_role AS ENUM ('student','admin');
CREATE TYPE public.class_level AS ENUM ('6','7','8','9','10','11','12');
CREATE TYPE public.question_type AS ENUM ('single','multiple','true_false','assertion_reason','numerical','fill_blank','match');
CREATE TYPE public.difficulty AS ENUM ('easy','medium','hard');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  class class_level,
  avatar_url TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Admin visibility policies
CREATE POLICY "profiles_admin_read_all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_read_all" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- updated_at trigger util
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'student')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant admin only to the seeded email once verified
CREATE OR REPLACE FUNCTION public.grant_admin_if_seeded_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'provashmanna10@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_grant_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_seeded_email();
CREATE TRIGGER on_auth_user_confirmed_grant_admin AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_if_seeded_email();

-- Content hierarchy
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  level class_level NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(board_id, level)
);
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  position INT NOT NULL DEFAULT 0,
  UNIQUE(class_id, slug)
);
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bank_id UUID NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  type question_type NOT NULL DEFAULT 'single',
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  difficulty difficulty NOT NULL DEFAULT 'medium',
  tags TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER questions_set_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants + RLS for content tables (all authed users read, only admins write)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['boards','classes','subjects','chapters','topics','question_banks','questions']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%I_read_all_authed" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%I_admin_write" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))', t, t);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_if_seeded_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

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

CREATE POLICY "attempts_own_read" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "attempts_own_insert" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_admin_read" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS quiz_attempts_user_created_idx ON public.quiz_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_subject_idx ON public.quiz_attempts(user_id, subject_id);

ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quiz_attempts_session_idx ON public.quiz_attempts(user_id, session_id, created_at);

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

CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  class_level class_level,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_set_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX push_subscriptions_class_idx ON public.push_subscriptions(class_level);

ALTER TABLE public.live_quizzes ADD COLUMN reminder_sent_at timestamptz;

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
GRANT SELECT, INSERT, UPDATE ON public.question_reports TO authenticated;
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

-- FIX: has_role must stay executable by signed-in users because every RLS
-- policy above calls it. A previous migration revoked it from `authenticated`,
-- which made every post-login query fail with "permission denied for function".
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;