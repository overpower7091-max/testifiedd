# Live Quiz Module — Implementation Plan

This is a large, cross-cutting feature. Below is a focused, buildable plan that maps every requirement in your brief to concrete tables, server code, and UI. I'll implement it in a single pass after you approve, then verify.

## 1. Data model (new tables)

All in `public` schema with RLS + GRANTs.

- `live_quiz_blueprints` — per (class_level, subject_id) persistent config: `questions_total`, `question_seconds`, `difficulty_easy/medium/hard`, `lookback_weeks`, `is_active`, `created_by`, timestamps. **Latest active row per (class, subject) is used every week** (persistent topic config).
- `live_quiz_blueprint_topics` — child of blueprint: `topic_id`, `question_count`.
- `live_quiz_blueprint_versions` — immutable snapshot (JSON) of blueprint + topics on every save (version history).
- `live_quizzes` — one row per scheduled quiz occurrence: `class_level`, `subject_id`, `scheduled_at` (UTC, materialized from 21:00 Asia/Kolkata), `status` (`scheduled|configuration_required|generating|live|ended|cancelled`), `blueprint_version_id`, `start_at`, `end_at`, `current_question_index`, `current_question_start_at`.
- `live_quiz_questions` — frozen ordered questions for that quiz: `live_quiz_id`, `position`, `question_id`, `topic_id`, `difficulty`. Correct answer NOT duplicated (read via join, hidden until end).
- `live_quiz_participants` — `live_quiz_id`, `user_id`, `joined_at`, `score`, `correct_count`, `total_time_ms`, `finished_at`, `rank`.
- `live_quiz_answers` — `live_quiz_id`, `user_id`, `question_position`, `selected_index`, `is_correct`, `submitted_at`, `response_ms`. Unique on (quiz, user, position). One-shot submission enforced by policy + unique index.
- `live_quiz_streaks` — per user per class: `current_streak`, `longest_streak`, `last_participated_on`, `total_attempted`.
- `xp_history` — `user_id`, `source` (`live_quiz_participation|top100|top10|champion|...`), `amount`, `ref_id`, `created_at`. Aggregated into `profiles.xp` via trigger.
- `achievements` + `user_achievements` — badge catalog + awards (`champion`, `top10`, `top100`, `streak_7`, etc.).

RLS summary:
- Students: SELECT own participant/answer rows; SELECT `live_quizzes` for their class; SELECT `live_quiz_questions` only when quiz `status='live'` or `ended`; SELECT correct answers + explanations only when `ended`.
- Admins (`has_role(admin)`): full manage on blueprints, quizzes, versions.
- All writes to score/rank/answers go through server functions (service role) after validation — students only INSERT their own answer row via a validated server fn, never direct table writes.

## 2. Server logic (`createServerFn` + one cron route)

Client-safe `.functions.ts` files; admin/service work via `await import('@/integrations/supabase/client.server')` inside handlers.

- `admin.live-quiz.functions.ts`
  - `saveBlueprint({class, subject, topics[], difficulty, questions_total, question_seconds, is_active})` — validates topic counts sum to total and difficulty sum to total, writes blueprint + child topics + a new `blueprint_versions` snapshot.
  - `listBlueprints`, `getBlueprint`, `listBlueprintVersions`.
  - `previewGeneration(blueprint_id)` — dry run using the same generator.
- `live-quiz.functions.ts` (student)
  - `getTodaysLiveQuiz()` — resolves current/next quiz for the user's class.
  - `joinLiveQuiz(quiz_id)` — upserts participant, returns current server state.
  - `getLiveState(quiz_id)` — returns `{status, current_index, question, options, question_start_at, question_end_at, server_now, my_answer?}`. Never returns `correct_answer` until `ended`.
  - `submitAnswer(quiz_id, position, selected_index)` — validates window, enforces one-shot, computes `is_correct` server-side, writes row, updates participant aggregates.
  - `getResults(quiz_id)` — final score, rank, percentile, breakdown, question review with correct answers + explanations (only when ended).
  - `getLeaderboard(quiz_id)` — top N + user's row, ranked by score desc, accuracy desc, total_time_ms asc, first-submission tiebreaker.
- `src/routes/api/public/hooks/live-quiz-tick.ts` — cron endpoint, `apikey` auth.
  - Runs every minute.
  - **Weekly materialization**: for each class × today's subject (Mon=Math, Tue=PhysSci, Wed=LifeSci, Thu=Math, Fri=PhysSci, Sat=LifeSci, Sun=none, Asia/Kolkata), ensure a `live_quizzes` row exists for tonight 21:00 IST. If no active blueprint → status `configuration_required`.
  - **Generation** (T-5 min): pick questions per topic + difficulty from the blueprint, excluding question_ids used in this (class, subject) within `lookback_weeks`. Validates blueprint constraints before publishing.
  - **Start** (at 21:00 IST): set status `live`, position 0, `current_question_start_at = now()`.
  - **Advance**: when `now >= current_question_start_at + question_seconds`, increment position; when past last, finalize (compute ranks, award XP, update streaks, insert achievements, set `ended`).

Two pg_cron jobs (via `supabase--insert`):
- `* * * * *` → live-quiz-tick (drives everything above).
- Notifications at 20:45 and 20:59 IST are surfaced client-side via realtime + a scheduled toast; no external push provider needed.

## 3. Realtime sync

- Enable Realtime on `live_quizzes`, `live_quiz_participants` (for leaderboard).
- Students subscribe to their quiz row. When `current_question_index` or `status` changes, they refetch `getLiveState`. Server timestamps drive countdown; client only renders `end_at - server_now` (with clock-skew offset captured at join). No client-side authoritative timer.

## 4. UI

- **Admin → Live Quiz Configuration** (`/admin/live-quiz`)
  - Class + subject picker, topics multi-select with per-topic question count, difficulty distribution, question count, per-question seconds, enable/disable, lookback weeks.
  - Live validation (topic sum, difficulty sum). Save → new version.
  - Version history drawer.
  - Today's scheduled quizzes list with status chips.
- **Student → Live Quiz** (`/live`)
  - Countdown to 21:00 IST + subject of the day.
  - At start: full-screen quiz shell — progress bar, `Question X of N`, server-synced timer ring, options, one-shot lock, "Waiting for next question…" between items, late-join lands on current question with previous auto-marked "Not Attempted".
  - Reconnect: refetches state, restores locked answers.
- **Post-quiz**
  - Result screen (score, rank, percentile, accuracy, avg time, breakdown).
  - Leaderboard (live during quiz, final after end); highlights current user.
  - Review screen (question, your answer, correct answer, explanation, topic, difficulty) — read-only, only when ended.
- **Profile additions**
  - Streak card, live-quiz history, XP timeline, achievements grid.

Header gets a **Live** link with a red dot when a quiz is currently live for the user's class.

## 5. Anti-cheating

- All timing + correctness server-side.
- Unique index on `(live_quiz_id, user_id, position)` → hard one-shot.
- Correct answers withheld until `ended` via RLS + server-fn projection.
- No prev/next buttons; position is server-driven.
- Optional multi-tab warning via BroadcastChannel; optional fullscreen toggle.

## 6. Scope boundaries for this pass

In scope now: everything above, wired end-to-end for the three subjects and classes 6–12, with cron running every minute.

Out of scope (explicitly deferred, architecture leaves room):
- Teacher-hosted ad-hoc quizzes, inter-school events, push notifications via FCM/OneSignal, WebSocket presence counts. Data model supports adding these later without migration churn.

## 7. Verification after build

- Migration applies cleanly; `supabase--linter` clean.
- Seed a blueprint for Class 10 / Physical Science; force `scheduled_at = now()+2min` via admin "Run now" button; join as a student in the preview; verify: question advances on server tick, one-shot submit works, leaderboard populates, results + review appear only after end, streak + XP increment.
- Playwright smoke: admin saves blueprint → cron generates → student sees synced timer → submits → sees results.

---

Approve this and I'll build it in one go (migration + server fns + cron + admin UI + student UI + profile additions), then run the verification steps and fix anything that fails.
