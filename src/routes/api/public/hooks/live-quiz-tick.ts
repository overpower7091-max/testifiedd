import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/live-quiz-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runLiveQuizTick } = await import("@/lib/live-quiz-scheduler.server");
          const result = await runLiveQuizTick();
          return Response.json(result);
        } catch (e: any) {
          console.error("live-quiz-tick failed", e);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
      GET: async () => {
        try {
          const { runLiveQuizTick } = await import("@/lib/live-quiz-scheduler.server");
          const result = await runLiveQuizTick();
          return Response.json(result);
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500 });
        }
      },
    },
  },
});
