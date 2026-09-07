import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SaveInput = {
  class_level: string;
  subject_id: string;
  questions_total: number;
  question_seconds: number;
  difficulty_easy: number;
  difficulty_medium: number;
  difficulty_hard: number;
  lookback_weeks: number;
  is_active: boolean;
  topics: { topic_id: string; question_count: number }[];
};

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden");
}

export const saveBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SaveInput) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const topicSum = data.topics.reduce((s, t) => s + t.question_count, 0);
    const diffSum = data.difficulty_easy + data.difficulty_medium + data.difficulty_hard;
    if (topicSum !== data.questions_total)
      throw new Error(`Topic counts (${topicSum}) must equal total questions (${data.questions_total})`);
    if (diffSum !== data.questions_total)
      throw new Error(`Difficulty counts (${diffSum}) must equal total questions (${data.questions_total})`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert blueprint
    const { data: existing } = await supabaseAdmin
      .from("live_quiz_blueprints")
      .select("id")
      .eq("class_level", data.class_level as any)
      .eq("subject_id", data.subject_id)
      .maybeSingle();

    const payload = {
      class_level: data.class_level as any,
      subject_id: data.subject_id,
      questions_total: data.questions_total,
      question_seconds: data.question_seconds,
      difficulty_easy: data.difficulty_easy,
      difficulty_medium: data.difficulty_medium,
      difficulty_hard: data.difficulty_hard,
      lookback_weeks: data.lookback_weeks,
      is_active: data.is_active,
      created_by: context.userId,
    };

    let blueprintId: string;
    if (existing) {
      const { error } = await supabaseAdmin.from("live_quiz_blueprints").update(payload).eq("id", existing.id);
      if (error) throw error;
      blueprintId = existing.id;
      await supabaseAdmin.from("live_quiz_blueprint_topics").delete().eq("blueprint_id", blueprintId);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("live_quiz_blueprints")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      blueprintId = inserted.id;
    }

    if (data.topics.length) {
      const { error: te } = await supabaseAdmin.from("live_quiz_blueprint_topics").insert(
        data.topics.map((t) => ({
          blueprint_id: blueprintId,
          topic_id: t.topic_id,
          question_count: t.question_count,
        })),
      );
      if (te) throw te;
    }

    const snapshot = {
      ...payload,
      topics: data.topics,
      saved_at: new Date().toISOString(),
    };
    await supabaseAdmin.from("live_quiz_blueprint_versions").insert({
      blueprint_id: blueprintId,
      class_level: data.class_level as any,
      subject_id: data.subject_id,
      snapshot: snapshot as any,
      created_by: context.userId,
    });

    return { ok: true, blueprint_id: blueprintId };
  });

export const getBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { class_level: string; subject_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: bp } = await context.supabase
      .from("live_quiz_blueprints")
      .select("*")
      .eq("class_level", data.class_level as any)
      .eq("subject_id", data.subject_id)
      .maybeSingle();
    if (!bp) return { blueprint: null, topics: [] };
    const { data: topics } = await context.supabase
      .from("live_quiz_blueprint_topics")
      .select("*")
      .eq("blueprint_id", bp.id);
    return { blueprint: bp, topics: topics ?? [] };
  });

export const listBlueprints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("live_quiz_blueprints")
      .select("*, subjects(name, slug, class_id, classes(level))")
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const listBlueprintVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { blueprint_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: versions } = await context.supabase
      .from("live_quiz_blueprint_versions")
      .select("*")
      .eq("blueprint_id", data.blueprint_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return versions ?? [];
  });

// Admin trigger: run the scheduler tick immediately (useful for testing / manual regen)
export const runSchedulerNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runLiveQuizTick } = await import("./live-quiz-scheduler.server");
    const result = await runLiveQuizTick();
    return result;
  });

// Admin: force-start a quiz right now (for testing) — schedules for now + 30s
export const adminScheduleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { class_level: string; subject_id: string; minutes_from_now?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const when = new Date(Date.now() + (data.minutes_from_now ?? 1) * 60_000);
    // Round to minute
    when.setSeconds(0, 0);
    const { data: bp } = await supabaseAdmin
      .from("live_quiz_blueprints")
      .select("*")
      .eq("class_level", data.class_level as any)
      .eq("subject_id", data.subject_id)
      .maybeSingle();
    if (!bp) throw new Error("No blueprint for this class/subject");
    // Insert quiz row if not already present at that scheduled_at
    const { data: existing } = await supabaseAdmin
      .from("live_quizzes")
      .select("id")
      .eq("class_level", data.class_level as any)
      .eq("subject_id", data.subject_id)
      .eq("scheduled_at", when.toISOString())
      .maybeSingle();
    if (existing) return { ok: true, live_quiz_id: existing.id, scheduled_at: when.toISOString() };
    const { data: q, error } = await supabaseAdmin
      .from("live_quizzes")
      .insert({
        class_level: data.class_level as any,
        subject_id: data.subject_id,
        scheduled_at: when.toISOString(),
        status: "scheduled",
        questions_total: bp.questions_total,
        question_seconds: bp.question_seconds,
      })
      .select("id")
      .single();
    if (error) throw error;
    // Trigger generation immediately
    const { runLiveQuizTick } = await import("./live-quiz-scheduler.server");
    await runLiveQuizTick();
    return { ok: true, live_quiz_id: q.id, scheduled_at: when.toISOString() };
  });

export const listAdminLiveQuizResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { class_level: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quizzes, error: quizError } = await supabaseAdmin
      .from("live_quizzes")
      .select("id, scheduled_at, ended_at, status, questions_total, subjects(name)")
      .eq("class_level", data.class_level as any)
      .order("scheduled_at", { ascending: false })
      .limit(30);
    if (quizError) throw quizError;

    const quizIds = (quizzes ?? []).map((quiz) => quiz.id);
    if (!quizIds.length) return { quizzes: [], participants: [] };
    const { data: participants, error: participantError } = await supabaseAdmin
      .from("live_quiz_participants")
      .select("live_quiz_id, user_id, score, correct_count, answered_count, total_time_ms, rank, joined_at, finished_at")
      .in("live_quiz_id", quizIds)
      .order("score", { ascending: false })
      .order("correct_count", { ascending: false })
      .order("total_time_ms", { ascending: true });
    if (participantError) throw participantError;

    const userIds = [...new Set((participants ?? []).map((row) => row.user_id))];
    const { data: profiles, error: profileError } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return {
      quizzes: quizzes ?? [],
      participants: (participants ?? []).map((row) => ({ ...row, profile: profileById.get(row.user_id) ?? null })),
    };
  });
