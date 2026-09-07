import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut, ShieldCheck, ArrowLeft, User, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader({ isAdmin, back }: { isAdmin?: boolean; back?: { to: string; label?: string; params?: Record<string, string> } }) {
  const navigate = useNavigate();
  const signOut = async () => {
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl btn-gradient">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
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
          {isAdmin && (
            <Link to="/admin" className="hidden sm:inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Admin
            </Link>
          )}
          <Link to="/profile" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors" aria-label="Profile">
            <User className="h-3.5 w-3.5 text-primary" /> <span className="hidden sm:inline">Profile</span>
          </Link>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium hover:text-primary transition-colors">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
