import { Link } from "@tanstack/react-router";
import { Calculator, Atom, Leaf, BookOpen, FlaskConical, ArrowRight } from "lucide-react";

const SUBJECT_META: Record<string, {
  icon: React.ElementType;
  from: string;
  to: string;
  glow: string;
  label: string;
}> = {
  Mathematics: {
    icon: Calculator,
    from: "var(--subject-math)",
    to: "var(--subject-math-2)",
    glow: "var(--subject-math-glow)",
    label: "Math",
  },
  "Physical Science": {
    icon: Atom,
    from: "var(--subject-science)",
    to: "var(--subject-science-2)",
    glow: "var(--subject-science-glow)",
    label: "Science",
  },
  Physics: {
    icon: Atom,
    from: "var(--subject-science)",
    to: "var(--subject-science-2)",
    glow: "var(--subject-science-glow)",
    label: "Science",
  },
  "Life Science": {
    icon: Leaf,
    from: "var(--subject-life)",
    to: "var(--subject-life-2)",
    glow: "var(--subject-life-glow)",
    label: "Life",
  },
  Chemistry: {
    icon: FlaskConical,
    from: "var(--subject-chem)",
    to: "var(--subject-chem-2)",
    glow: "var(--subject-chem-glow)",
    label: "Chemistry",
  },
};

interface SubjectCardProps {
  id: string;
  name: string;
  chapters?: number;
  attempts?: number;
  accuracy?: number;
  className?: string;
}

export function SubjectCard({ id, name, chapters = 0, attempts = 0, accuracy = 0, className = "" }: SubjectCardProps) {
  const meta = SUBJECT_META[name] ?? {
    icon: BookOpen,
    from: "var(--subject-math)",
    to: "var(--subject-math-2)",
    glow: "var(--subject-math-glow)",
    label: "Subject",
  };
  const Icon = meta.icon;
  const started = attempts > 0;
  const pct = Math.max(0, Math.min(100, accuracy || (started ? 35 : 0)));

  return (
    <Link
      to="/subject/$id"
      params={{ id }}
      className={`group relative block overflow-hidden rounded-3xl p-5 transition-transform hover:scale-[1.02] active:scale-[0.99] ${className}`}
    >
      {/* gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${meta.from}, ${meta.to})` }}
      />

      {/* decorative glow orbs */}
      <div
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-35 blur-3xl"
        style={{ background: meta.glow }}
      />
      <div
        className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full opacity-25 blur-3xl"
        style={{ background: meta.glow }}
      />

      {/* large watermark icon */}
      <Icon className="absolute -right-5 -bottom-5 h-44 w-44 rotate-12 text-white/8 pointer-events-none" />

      {/* content */}
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25 shadow-lg backdrop-blur-sm">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-white/20">
              {started ? "Active" : "New"}
            </span>
            <ArrowRight className="h-4 w-4 text-white/60 transition-colors group-hover:text-white" />
          </div>
        </div>

        <div className="mt-5 flex-1">
          <h3 className="text-xl font-bold tracking-tight text-white">{name}</h3>
          <p className="mt-1 text-sm text-white/80">
            {chapters} chapters · {attempts} attempts
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-white/80">{started ? "In Progress" : "Not Started"}</span>
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-white ring-1 ring-inset ring-white/20">
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-white/90 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
