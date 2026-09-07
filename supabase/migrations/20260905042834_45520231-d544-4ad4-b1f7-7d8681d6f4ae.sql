UPDATE public.live_quiz_blueprints AS blueprint
SET is_active = true,
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.live_quiz_blueprint_topics AS blueprint_topic
  WHERE blueprint_topic.blueprint_id = blueprint.id
)
AND EXISTS (
  SELECT 1
  FROM public.live_quiz_blueprint_topics AS blueprint_topic
  JOIN public.question_banks AS bank ON bank.topic_id = blueprint_topic.topic_id
  JOIN public.questions AS question ON question.question_bank_id = bank.id
  WHERE blueprint_topic.blueprint_id = blueprint.id
);