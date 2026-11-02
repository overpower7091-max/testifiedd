import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, ArrowLeft, User, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

let adminCache: { uid: string; isAdmin: boolean } | null = null;

export function AppHeader({ isAdmin, back }: { isAdmin?: boolean; back?: { to: string; label?: string; params?: Record<string, string> } }) {
  const navigate = useNavigate();
  const [roleAdmin, setRoleAdmin] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      if (adminCache?.uid === uid) { if (!cancelled) setRoleAdmin(adminCache.isAdmin); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const result = !!roles?.some((r: any) => r.role === "admin");
      adminCache = { uid, isAdmin: result };
      if (!cancelled) setRoleAdmin(result);
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const showAdmin = isAdmin || roleAdmin;

  const signOut = async () => {
    adminCache = null;
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <header className="relative z-30 px-4 sm:px-6 lg:px-10 pt-4">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          {back && (
            <Link to={back.to as any} params={back.params as any} className="glass rounded-full h-8 w-8 inline-flex items-center justify-center hover:text-primary" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <Link to="/home" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              className="h-9 w-9 rounded-xl object-cover"
              width="36"
              height="36"
            />
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight">testified</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">WBBSE</div>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/live" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors" aria-label="Live Quiz">
            <Radio className="h-3.5 w-3.5 text-red-500" /> <span className="hidden sm:inline">Live</span>
          </Link>
          {showAdmin && (
            <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors" aria-label="Admin Panel">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link to="/profile" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors" aria-label="Profile">
            <User className="h-3.5 w-3.5 text-primary" /> <span className="hidden sm:inline">Profile</span>
          </Link>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors" aria-label="Sign out">
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
