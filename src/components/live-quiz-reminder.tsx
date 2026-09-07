import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { getTodaysLiveQuiz } from "@/lib/live-quiz.functions";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const LEAD_MS = 5 * 60 * 1000;

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LiveQuizReminder() {
  const { supported, state, subscribed, busy, enable, disable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const toasted = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["todays-live-quiz-reminder"],
    queryFn: () => getTodaysLiveQuiz(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const quiz: any = data?.quiz ?? null;
  const startsIn = useMemo(
    () => (quiz?.scheduled_at ? new Date(quiz.scheduled_at).getTime() - now : Number.POSITIVE_INFINITY),
    [quiz?.scheduled_at, now],
  );

  const inWindow =
    !!quiz && quiz.status !== "ended" && quiz.status !== "cancelled" && startsIn <= LEAD_MS && startsIn > -60_000;

  // In-app toast, fired once per quiz when the 5 minute window opens.
  useEffect(() => {
    if (!inWindow || !quiz?.id || toasted.current === quiz.id) return;
    toasted.current = quiz.id;
    toast.success("Live quiz starts in 5 minutes!", {
      description: `${quiz.subjects?.name ?? "Today's quiz"} · Class ${quiz.class_level}. Get ready.`,
      duration: 10_000,
    });
  }, [inWindow, quiz?.id, quiz?.class_level, quiz?.subjects?.name]);

  if (inWindow && !dismissed) {
    const live = startsIn <= 0;
    return (
      <div className="relative overflow-hidden rounded-3xl border border-[oklch(0.68_0.22_25/0.4)] bg-[oklch(0.68_0.22_25/0.14)] p-4 backdrop-blur-xl">
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss reminder"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[oklch(0.68_0.22_25)] text-white">
            <Radio className="h-5 w-5 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight">
              {live ? "Live quiz is starting now!" : `Live quiz starts in ${fmt(startsIn)}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {quiz.subjects?.name ?? "Live mock"} · Class {quiz.class_level} · {quiz.questions_total} questions
            </p>
          </div>
          <Link
            to="/live"
            className="rounded-full bg-[oklch(0.68_0.22_25)] px-4 py-2 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            {live ? "Join now" : "Get ready"}
          </Link>
        </div>
      </div>
    );
  }

  if (!supported || subscribed) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {state === "denied" ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Live quiz reminders</p>
        <p className="text-xs text-muted-foreground">
          {state === "denied"
            ? "Notifications are blocked. Allow them in your browser settings to get the 5-minute reminder."
            : "Get a notification 5 minutes before every live quiz for your class."}
        </p>
      </div>
      {state !== "denied" && (
        <button
          onClick={() => void enable()}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-105 disabled:opacity-60"
        >
          {busy ? "Enabling…" : "Turn on"}
        </button>
      )}
      {subscribed && (
        <button onClick={() => void disable()} className="text-xs text-muted-foreground hover:underline">
          Turn off
        </button>
      )}
    </div>
  );
}
