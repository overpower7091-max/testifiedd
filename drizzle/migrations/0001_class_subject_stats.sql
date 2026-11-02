CREATE OR REPLACE FUNCTION public.get_class_subject_stats(_subject_id uuid)
RETURNS TABLE (user_id uuid, correct bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id, count(*) FILTER (WHERE a.is_correct), count(*)
  FROM public.quiz_attempts a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.subject_id = _subject_id
    AND p.class = (SELECT me.class FROM public.profiles me WHERE me.id = auth.uid())
  GROUP BY a.user_id
$$;
REVOKE ALL ON FUNCTION public.get_class_subject_stats(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_class_subject_stats(uuid) TO authenticated;