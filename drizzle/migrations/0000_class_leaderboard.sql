CREATE OR REPLACE FUNCTION public.get_class_leaderboard()
RETURNS TABLE (id uuid, full_name text, avatar_url text, class class_level, xp integer, streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.class, p.xp, p.streak
  FROM public.profiles p
  WHERE p.class IS NOT NULL
    AND p.is_banned = false
    AND p.class = (SELECT me.class FROM public.profiles me WHERE me.id = auth.uid())
    AND NOT public.has_role(p.id, 'admin')
  ORDER BY p.xp DESC
  LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.get_class_leaderboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_class_leaderboard() TO authenticated;