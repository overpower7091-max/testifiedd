-- Full schema for the external Supabase project (hecqnhmfllvqipttbpxe).
-- Paste this whole file into that project's SQL editor and run it once.

-- ── Types ────────────────────────────────────────────────────────────────────
do $$ begin create type public.app_role as enum ('student','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.class_level as enum ('6','7','8','9','10','11','12'); exception when duplicate_object then null; end $$;
do $$ begin create type public.difficulty as enum ('easy','medium','hard'); exception when duplicate_object then null; end $$;
do $$ begin create type public.live_quiz_status as enum ('scheduled','configuration_required','generating','live','ended','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.question_type as enum ('single','multiple','true_false','assertion_reason','numerical','fill_blank','match'); exception when duplicate_object then null; end $$;

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ── Roles ────────────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "admins read all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  class public.class_level,
  avatar_url text,
  xp integer not null default 0,
  streak integer not null default 0,
  onboarding_completed boolean not null default false,
  is_banned boolean not null default false,
  banned_reason text,
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "admin profile read" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin profile update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (new.id,'student') on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── Content tree ─────────────────────────────────────────────────────────────
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  created_at timestamptz not null default now()
);
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  level public.class_level not null,
  name text not null
);
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  slug text not null,
  icon text,
  color text,
  position integer not null default 0
);
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references public.question_banks(id) on delete cascade,
  type public.question_type not null default 'single',
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null default '[]'::jsonb,
  explanation text,
  difficulty public.difficulty not null default 'medium',
  tags text[] not null default '{}',
  images text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['boards','classes','subjects','chapters','topics','question_banks','questions'] loop
    execute format('grant select on public.%I to authenticated, anon', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "readable by everyone" on public.%I for select using (true)', t);
    execute format('create policy "admins manage" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ── Practice attempts ────────────────────────────────────────────────────────
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  session_id uuid,
  selected_index integer,
  is_correct boolean not null default false,
  time_seconds integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;
alter table public.quiz_attempts enable row level security;
create policy "own attempts read" on public.quiz_attempts for select to authenticated using (auth.uid() = user_id);
create policy "own attempts insert" on public.quiz_attempts for insert to authenticated with check (auth.uid() = user_id);
create policy "admin attempts read" on public.quiz_attempts for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ── XP, achievements ─────────────────────────────────────────────────────────
create table if not exists public.xp_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  amount integer not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.xp_history to authenticated;
grant all on public.xp_history to service_role;
alter table public.xp_history enable row level security;
create policy "own xp read" on public.xp_history for select to authenticated using (auth.uid() = user_id);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  created_at timestamptz not null default now()
);
grant select on public.achievements to authenticated, anon;
grant all on public.achievements to service_role;
alter table public.achievements enable row level security;
create policy "achievements readable" on public.achievements for select using (true);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  ref_id uuid,
  awarded_at timestamptz not null default now()
);
grant select on public.user_achievements to authenticated;
grant all on public.user_achievements to service_role;
alter table public.user_achievements enable row level security;
create policy "own achievements read" on public.user_achievements for select to authenticated using (auth.uid() = user_id);

-- ── Live quiz blueprints ─────────────────────────────────────────────────────
create table if not exists public.live_quiz_blueprints (
  id uuid primary key default gen_random_uuid(),
  class_level public.class_level not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  questions_total integer not null default 10,
  question_seconds integer not null default 30,
  difficulty_easy integer not null default 0,
  difficulty_medium integer not null default 0,
  difficulty_hard integer not null default 0,
  lookback_weeks integer not null default 4,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_level, subject_id)
);
create trigger trg_lq_blueprints_updated before update on public.live_quiz_blueprints for each row execute function public.set_updated_at();

create table if not exists public.live_quiz_blueprint_topics (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.live_quiz_blueprints(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  question_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.live_quiz_blueprint_versions (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.live_quiz_blueprints(id) on delete cascade,
  class_level public.class_level not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['live_quiz_blueprints','live_quiz_blueprint_topics','live_quiz_blueprint_versions'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admins manage" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t);
  end loop;
end $$;

-- ── Live quizzes ─────────────────────────────────────────────────────────────
create table if not exists public.live_quizzes (
  id uuid primary key default gen_random_uuid(),
  class_level public.class_level not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  scheduled_at timestamptz not null,
  status public.live_quiz_status not null default 'scheduled',
  blueprint_version_id uuid references public.live_quiz_blueprint_versions(id) on delete set null,
  questions_total integer not null default 10,
  question_seconds integer not null default 30,
  current_question_index integer not null default 0,
  current_question_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_live_quizzes_updated before update on public.live_quizzes for each row execute function public.set_updated_at();
grant select on public.live_quizzes to authenticated, anon;
grant all on public.live_quizzes to service_role;
alter table public.live_quizzes enable row level security;
create policy "live quizzes readable" on public.live_quizzes for select using (true);
create policy "admins manage live quizzes" on public.live_quizzes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant insert, update, delete on public.live_quizzes to authenticated;

create table if not exists public.live_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  live_quiz_id uuid not null references public.live_quizzes(id) on delete cascade,
  position integer not null,
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  difficulty public.difficulty not null default 'medium',
  unique (live_quiz_id, position)
);
grant select on public.live_quiz_questions to authenticated;
grant all on public.live_quiz_questions to service_role;
alter table public.live_quiz_questions enable row level security;
create policy "live quiz questions readable" on public.live_quiz_questions for select to authenticated using (true);

create table if not exists public.live_quiz_participants (
  id uuid primary key default gen_random_uuid(),
  live_quiz_id uuid not null references public.live_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  score integer not null default 0,
  correct_count integer not null default 0,
  answered_count integer not null default 0,
  total_time_ms bigint not null default 0,
  last_submit_at timestamptz,
  finished_at timestamptz,
  rank integer,
  unique (live_quiz_id, user_id)
);
grant select on public.live_quiz_participants to authenticated;
grant all on public.live_quiz_participants to service_role;
alter table public.live_quiz_participants enable row level security;
create policy "participants readable" on public.live_quiz_participants for select to authenticated using (true);

create table if not exists public.live_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  live_quiz_id uuid not null references public.live_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_index integer,
  is_correct boolean not null default false,
  response_ms integer not null default 0,
  submitted_at timestamptz not null default now(),
  unique (live_quiz_id, user_id, position)
);
grant select on public.live_quiz_answers to authenticated;
grant all on public.live_quiz_answers to service_role;
alter table public.live_quiz_answers enable row level security;
create policy "own live answers read" on public.live_quiz_answers for select to authenticated using (auth.uid() = user_id);

create table if not exists public.live_quiz_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_level public.class_level not null,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  total_attempted integer not null default 0,
  last_participated_on date,
  updated_at timestamptz not null default now(),
  unique (user_id, class_level)
);
create trigger trg_lq_streaks_updated before update on public.live_quiz_streaks for each row execute function public.set_updated_at();
grant select on public.live_quiz_streaks to authenticated;
grant all on public.live_quiz_streaks to service_role;
alter table public.live_quiz_streaks enable row level security;
create policy "own streaks read" on public.live_quiz_streaks for select to authenticated using (auth.uid() = user_id);

-- ── Reports & push ───────────────────────────────────────────────────────────
create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  report_text text not null,
  source text not null default 'practice',
  quiz_attempt_id uuid references public.quiz_attempts(id) on delete set null,
  live_quiz_id uuid references public.live_quizzes(id) on delete set null,
  status text not null default 'open',
  admin_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger question_reports_set_updated_at before update on public.question_reports for each row execute function public.set_updated_at();
grant select, insert, update on public.question_reports to authenticated;
grant all on public.question_reports to service_role;
alter table public.question_reports enable row level security;
create policy "own reports read" on public.question_reports for select to authenticated using (auth.uid() = reporter_id);
create policy "own reports insert" on public.question_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "admins manage reports" on public.question_reports for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  class_level public.class_level,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
