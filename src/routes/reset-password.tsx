import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Testified" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="liquid-glass-strong w-full max-w-md rounded-3xl p-8">
        <h1 className="text-2xl font-medium">Set a new password</h1>
        <p className="mt-1 text-sm text-white/60">Enter your new password below.</p>
        <div className="liquid-glass mt-6 flex items-center gap-2 rounded-full px-4 py-2.5">
          <Lock className="h-4 w-4 text-white/60" />
          <input
            type="password" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
        <button type="submit" disabled={busy}
          className="liquid-glass-strong mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Update password <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </div>
  );
}
