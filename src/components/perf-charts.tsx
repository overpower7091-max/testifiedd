import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  BarChart, Bar,
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

const AXIS = { fontSize: 10, fill: "var(--muted-foreground)" };

function ChartTooltip({ active, payload, label, unit = "%", name = "Accuracy" }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-border/60 bg-popover/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {p.payload?.date ? `${label} · ${p.payload.date}` : label}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-popover-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
        {p.value}{unit} <span className="font-normal text-muted-foreground">{name}</span>
      </div>
      {p.payload?.extra && <div className="mt-0.5 text-[11px] text-muted-foreground">{p.payload.extra}</div>}
    </div>
  );
}

export function AreaTrend({ data, gradientId, from, to, compact }: {
  data: { label: string; accuracy: number; date: string; extra?: string }[];
  gradientId: string; from: string; to: string; compact?: boolean;
}) {
  const avg = data.length ? Math.round(data.reduce((s, d) => s + d.accuracy, 0) / data.length) : 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 14, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity={0.45} />
            <stop offset="60%" stopColor={to} stopOpacity={0.12} />
            <stop offset="100%" stopColor={to} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeOpacity={0.25} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" hide={compact} tickMargin={8} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} axisLine={false} tickLine={false} width={30} tickFormatter={(v) => `${v}`} />
        <ReferenceLine y={avg} stroke={from} strokeOpacity={0.5} strokeDasharray="4 6"
          label={compact ? undefined : { value: `avg ${avg}%`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: from, strokeOpacity: 0.35, strokeWidth: 1, strokeDasharray: "3 3" }} />
        <Area
          type="monotone" dataKey="accuracy"
          stroke={`url(#${gradientId}-stroke)`} strokeWidth={3} strokeLinecap="round"
          fill={`url(#${gradientId})`} filter={`url(#${gradientId}-glow)`}
          dot={compact ? false : { r: 3, fill: "var(--card)", stroke: from, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "var(--card)", stroke: to, strokeWidth: 3 }}
          animationDuration={900} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ActivityBars({ data, from, to }: {
  data: { label: string; count: number; correct: number }[]; from: string; to: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }} barCategoryGap="22%">
        <defs>
          <linearGradient id="actTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity={0.35} />
            <stop offset="100%" stopColor={from} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="actCorrect" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={to} />
            <stop offset="100%" stopColor={from} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeOpacity={0.25} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.25, radius: 8 } as any}
          content={({ active, payload, label }: any) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-border/60 bg-popover/95 px-3 py-2 shadow-2xl backdrop-blur-md text-xs">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
                <div className="mt-1 font-semibold text-popover-foreground">{payload[0].payload.count} attempts</div>
                <div className="text-muted-foreground">{payload[0].payload.correct} correct</div>
              </div>
            ) : null
          }
        />
        <Bar dataKey="count" fill="url(#actTotal)" radius={[8, 8, 3, 3]} animationDuration={700} />
        <Bar dataKey="correct" fill="url(#actCorrect)" radius={[8, 8, 3, 3]} animationDuration={900} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmptyChart({ label = "Take at least 2 quizzes to see a trend." }: { label?: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/50 glass-tint text-center px-4">
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
    date: new Date(s.startedAt).toLocaleDateString([], { day: "numeric", month: "short" }),
    accuracy: Math.round((s.correct / s.total) * 100),
    extra: `${s.correct}/${s.total} correct · ${s.subjectName}`,
  }));
}

export const PALETTES = [
  { from: "hsl(221 83% 60%)", to: "hsl(199 89% 65%)" },
  { from: "hsl(160 84% 45%)", to: "hsl(180 80% 55%)" },
  { from: "hsl(280 80% 65%)", to: "hsl(320 80% 65%)" },
  { from: "hsl(30 90% 60%)", to: "hsl(45 95% 60%)" },
];
