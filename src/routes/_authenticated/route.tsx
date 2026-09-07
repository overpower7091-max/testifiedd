import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Ban check
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.is_banned) throw redirect({ to: "/suspended" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
