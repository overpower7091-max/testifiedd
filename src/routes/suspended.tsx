import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/suspended")({
  head: () => ({ meta: [{ title: "Account suspended — Testified" }] }),
  component: Suspended,
});

function Suspended() {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) { navigate({ to: "/auth", replace: true }); return; }
      const { data } = await supabase
        .from("profiles")
        .select("is_banned, banned_reason")
        .eq("id", userRes.user.id).maybeSingle();
      if (!data?.is_banned) { navigate({ to: "/home", replace: true }); return; }
      setReason(data.banned_reason);
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong max-w-md w-full rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Account suspended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your access to Testified has been temporarily restricted by an administrator.
        </p>
        {reason && (
          <div className="mt-4 glass rounded-2xl p-3 text-left text-sm">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Reason</div>
            <div className="mt-1 text-foreground">{reason}</div>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          If you believe this is a mistake, please contact support.
        </p>
        <button onClick={signOut} className="mt-6 glass inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium hover:text-primary">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
