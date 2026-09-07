import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Testified — Quality MCQ Practice & Live Mock Tests" },
      { name: "description", content: "Master Science & Math with quality MCQs and live mock tests, built for WBBSE students of classes 6 to 12." },
      { property: "og:title", content: "Testified — MCQ Practice for Science & Math" },
      { property: "og:description", content: "Practice MCQs and take live mock tests. Free for WBBSE students of classes 6–12." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <video className="absolute inset-0 z-0 h-full w-full object-cover" src={VIDEO_URL} autoPlay loop muted playsInline />
      <div className="absolute inset-0 z-0 bg-black/40" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight">testified</span>
        </div>
        <Link to="/auth" className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80 hover:text-white">
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-5xl flex-col items-center justify-center px-6 pb-16 text-center">
        <span className="liquid-glass rounded-full px-3 py-1 text-xs text-white/70">
          For WBBSE students · Classes 6 to 12
        </span>
        <h1 className="mt-6 text-5xl leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          Master <em className="font-serif not-italic italic text-white/80">Math</em> &{" "}
          <em className="font-serif not-italic italic text-white/80">Science</em>&nbsp;
          <div className="mt-2 text-[0.6em] opacity-60">with&nbsp;</div>
          <div className="text-white">Live MCQ Challenges</div>
        </h1>
        <p className="mt-5 max-w-xl text-base text-white/70">
          Quality question banks, live mock tests, and instant analytics —
          free for every student in Bengal.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm text-white transition-transform hover:scale-105 active:scale-95">
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/auth" className="liquid-glass inline-flex items-center rounded-full px-6 py-3 text-sm text-white/80 hover:text-white">
            I already have an account
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {["Topic-wise MCQs", "Live Mock Tests", "Instant Analytics", "AI Doubt Solver"].map((p) => (
            <span key={p} className="liquid-glass rounded-full px-3 py-1 text-xs text-white/80">{p}</span>
          ))}
        </div>
      </main>
    </div>
  );
}
