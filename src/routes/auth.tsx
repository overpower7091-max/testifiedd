import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, ArrowRight, GraduationCap, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Testified" },
      { name: "description", content: "Sign in or create your free Testified account for MCQ practice and live mock tests." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) {
      toast.error(error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    // On success, Supabase redirects the browser to Google, so nothing else runs here.
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        toast.success("Account created — signing you in…");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset link sent to your email.");
        setMode("signin");
        setBusy(false);
        return;
      }
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <video className="absolute inset-0 z-0 h-full w-full object-cover" src={VIDEO_URL} autoPlay loop muted playsInline />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-white">testified</span>
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-6 pb-16">
        <div className="mx-auto w-full max-w-md">
          <div className="liquid-glass-strong rounded-3xl p-6 sm:p-8">
            <h2 className="text-2xl font-medium tracking-tight text-white">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset your password"}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {mode === "signin" && "Sign in to continue practising."}
              {mode === "signup" && "Free forever. Classes 6–12."}
              {mode === "forgot" && "We'll email you a link to set a new password."}
            </p>

            {mode !== "forgot" && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={busy}
                  className="liquid-glass mt-6 flex w-full items-center justify-center gap-3 rounded-full py-3 text-sm text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  <GoogleGlyph />
                  Continue with Google
                </button>

                <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-white/40">
                  <span className="h-px flex-1 bg-white/15" />
                  or
                  <span className="h-px flex-1 bg-white/15" />
                </div>
              </>
            )}

            <form onSubmit={handleEmail} className="space-y-3">
              <div className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5">
                <Mail className="h-4 w-4 text-white/60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
              </div>

              {mode !== "forgot" && (
                <div className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5">
                  <Lock className="h-4 w-4 text-white/60" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="liquid-glass-strong flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    {mode === "signin" && "Sign in"}
                    {mode === "signup" && "Create account"}
                    {mode === "forgot" && "Send reset link"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex justify-between text-xs text-white/60">
              {mode === "signin" ? (
                <>
                  <button onClick={() => setMode("forgot")} className="hover:text-white">Forgot password?</button>
                  <button onClick={() => setMode("signup")} className="hover:text-white">Create account →</button>
                </>
              ) : (
                <button onClick={() => setMode("signin")} className="hover:text-white">← Back to sign in</button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}
