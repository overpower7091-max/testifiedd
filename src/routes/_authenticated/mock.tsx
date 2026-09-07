import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Clock, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/_authenticated/mock")({
  head: () => ({ meta: [{ title: "Live mock — Testified" }] }),
  component: Mock,
});

function Mock() {
  return (
    <div className="min-h-screen">
      <AppHeader back={{ to: "/home" }} />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="glass-strong rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl glass-tint text-primary">
            <Radio className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Live <span className="gradient-text">mock tests</span></h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Scheduled full-length MCQ mocks with real-time leaderboards launch in the next update. For now, sharpen your basics with chapter-wise practice.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <Link to="/subjects" className="btn-gradient rounded-full px-5 py-2 text-sm font-medium">Practice MCQs</Link>
            <Link to="/home" className="glass rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 hover:text-primary"><ArrowLeft className="h-4 w-4" /> Home</Link>
          </div>
          <div className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Next scheduled mock: TBA
          </div>
        </div>
      </main>
    </div>
  );
}
