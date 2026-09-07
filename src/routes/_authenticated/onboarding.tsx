import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Complete your profile — Testified" }] }),
  component: Onboarding,
});

const CLASSES = ["6", "7", "8", "9", "10", "11", "12"] as const;
type ClassLevel = (typeof CLASSES)[number];

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [cls, setCls] = useState<ClassLevel | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) {
          toast.error("Your session expired. Please log in again.");
          navigate({ to: "/auth", replace: true });
          return;
        }
        const { data: p, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, class, onboarding_completed")
          .eq("id", userRes.user.id)
          .maybeSingle();
        if (profErr) {
          toast.error(profErr.message);
          setChecked(true);
          return;
        }
        if (p?.onboarding_completed) {
          navigate({ to: "/home", replace: true });
          return;
        }
        setName(p?.full_name || (userRes.user.user_metadata?.full_name ?? userRes.user.user_metadata?.name ?? ""));
        if (p?.class) setCls(p.class as ClassLevel);
        setChecked(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong while loading your profile.");
        setChecked(true);
      }
    })();
  }, [navigate]);

  const finish = async () => {
    if (!name.trim() || !cls) return;
    setBusy(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        toast.error("Your session expired. Please log in again.");
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim(), class: cls, onboarding_completed: true })
        .eq("id", userRes.user.id)
        .select("id")
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        // Update matched zero rows (e.g. no profile row exists yet for this account).
        // Fall back to an upsert so onboarding can still complete.
        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert({ id: userRes.user.id, full_name: name.trim(), class: cls, onboarding_completed: true });
        if (upsertErr) {
          toast.error(upsertErr.message);
          return;
        }
      }
      toast.success("Profile saved.");
      navigate({ to: "/home", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
      <div className="liquid-glass-strong w-full max-w-md rounded-3xl p-8">
        <div className="text-xs uppercase tracking-widest text-white/50">Finish setup</div>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Tell us about you</h1>
        <p className="mt-1 text-sm text-white/60">We'll personalise your MCQs and mock tests.</p>

        <label className="mt-6 block text-xs text-white/60">Full name</label>
        <div className="liquid-glass mt-2 rounded-full px-4 py-2.5">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ananya Sharma"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>

        <label className="mt-5 block text-xs text-white/60">Select your class</label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {CLASSES.map((c) => {
            const active = cls === c;
            return (
              <button
                key={c}
                onClick={() => setCls(c)}
                aria-pressed={active}
                className={`${active
                  ? "liquid-glass-strong scale-105 bg-white/20 text-white"
                  : "liquid-glass text-white/80"} relative rounded-2xl py-3 text-sm transition-all hover:scale-105`}
              >
                {c}
                {active && <Check className="absolute right-1.5 top-1.5 h-3 w-3 text-white" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={finish}
          disabled={!name.trim() || !cls || busy}
          className="liquid-glass-strong mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}
