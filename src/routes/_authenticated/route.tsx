import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Cache the ban check so navigation between pages doesn't wait on the network.
let banCache: { userId: string; banned: boolean; at: number } | null = null;
const BAN_TTL = 5 * 60_000;

async function checkBanned(userId: string) {
  const { data } = await supabase.from("profiles").select("is_banned").eq("id", userId).maybeSingle();
  banCache = { userId, banned: !!data?.is_banned, at: Date.now() };
  return banCache.banned;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the local session (no network round-trip on every navigation).
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });

    const fresh = banCache && banCache.userId === user.id && Date.now() - banCache.at < BAN_TTL;
    if (fresh) {
      if (banCache!.banned) throw redirect({ to: "/suspended" });
      // Refresh in background without blocking navigation.
      if (Date.now() - banCache!.at > 60_000) void checkBanned(user.id);
    } else if (await checkBanned(user.id)) {
      throw redirect({ to: "/suspended" });
    }
    return { user };
  },
  pendingMs: 150,
  pendingComponent: PageSkeleton,
  component: () => <Outlet />,
});

function PageSkeleton() {
  return (
    <div className="min-h-screen mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6 space-y-4 animate-pulse">
      <div className="glass rounded-full h-14" />
      <div className="glass-strong rounded-3xl h-36" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-3xl h-28" />
        ))}
      </div>
    </div>
  );
}
