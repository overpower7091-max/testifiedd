
-- Backfill session_id and topic_id on legacy quiz_attempts by grouping consecutive attempts
-- from the same user on the same topic within the same minute.
WITH grp AS (
  SELECT qa.id,
         qa.user_id,
         COALESCE(qa.topic_id, qb.topic_id) AS resolved_topic_id,
         date_trunc('minute', qa.created_at) AS bucket
  FROM public.quiz_attempts qa
  LEFT JOIN public.questions q ON q.id = qa.question_id
  LEFT JOIN public.question_banks qb ON qb.id = q.question_bank_id
  WHERE qa.session_id IS NULL
),
sess AS (
  SELECT user_id, resolved_topic_id, bucket,
         gen_random_uuid() AS new_session_id
  FROM grp
  GROUP BY user_id, resolved_topic_id, bucket
)
UPDATE public.quiz_attempts qa
SET session_id = sess.new_session_id,
    topic_id = COALESCE(qa.topic_id, sess.resolved_topic_id)
FROM grp
JOIN sess ON sess.user_id = grp.user_id
         AND sess.bucket = grp.bucket
         AND (sess.resolved_topic_id IS NOT DISTINCT FROM grp.resolved_topic_id)
WHERE qa.id = grp.id AND qa.session_id IS NULL;
