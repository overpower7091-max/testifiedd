import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export type PerfAttempt = {
  is_correct: boolean;
  created_at: string;
  session_id?: string | null;
  topic_id?: string | null;
  subject_id?: string | null;
};

export type PerfSession = {
  key: string;
  subjectId: string | null;
  subjectName: string;
  total: number;
  correct: number;
  startedAt: string;
};

export function AreaTrend({ data, gradientId, from, to, compact }: {
  data: { label: string; accuracy: number; date: string }[];
  gradientId: string; from: string; to: string; compact?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity={0.55} />
            <stop offset="100%" stopColor={to} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 4" stroke="hsl(220 15% 30% / 0.25)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 10% 65%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" hide={compact} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: "hsl(220 10% 65%)" }} axisLine={false} tickLine={false} width={26} />
        <Tooltip
          cursor={{ stroke: "hsl(217 91% 60% / 0.4)", strokeWidth: 1 }}
          contentStyle={{ background: "hsl(222 30% 12% / 0.95)", border: "1px solid hsl(220 15% 25%)", borderRadius: 12, fontSize: 12, color: "white" }}
          labelStyle={{ color: "hsl(220 10% 70%)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
          formatter={(v: any) => [`${v}%`, "Accuracy"]}
        />
        <Area type="monotone" dataKey="accuracy" stroke={`url(#${gradientId}-stroke)`} strokeWidth={2.5} fill={`url(#${gradientId})`} activeDot={{ r: 5, stroke: from, strokeWidth: 2, fill: "white" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EmptyChart({ label = "Take at least 2 quizzes to see a trend." }: { label?: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground rounded-2xl glass-tint text-center px-4">
      {label}
    </div>
  );
}

export function groupSessions(rows: PerfAttempt[], subjectName: (id: string | null) => string): PerfSession[] {
  const map = new Map<string, PerfSession>();
  for (const r of rows) {
    const subjectId = r.subject_id ?? null;
    const key = r.session_id ? String(r.session_id) : `legacy:${r.topic_id ?? "x"}:${r.created_at.slice(0, 16)}`;
    const ex = map.get(key);
    if (ex) {
      ex.total += 1;
      ex.correct += r.is_correct ? 1 : 0;
      if (r.created_at < ex.startedAt) ex.startedAt = r.created_at;
    } else {
      map.set(key, {
        key, subjectId, subjectName: subjectName(subjectId),
        total: 1, correct: r.is_correct ? 1 : 0, startedAt: r.created_at,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
}

export function sessionsToSeries(sessions: PerfSession[]) {
  return sessions.map((s, i) => ({
    label: `#${i + 1}`,
    date: new Date(s.startedAt).toLocaleDateString(),
    accuracy: Math.round((s.correct / s.total) * 100),
  }));
}

export const PALETTES = [
  { from: "hsl(221 83% 60%)", to: "hsl(199 89% 65%)" },
  { from: "hsl(160 84% 45%)", to: "hsl(180 80% 55%)" },
  { from: "hsl(280 80% 65%)", to: "hsl(320 80% 65%)" },
  { from: "hsl(30 90% 60%)", to: "hsl(45 95% 60%)" },
];
