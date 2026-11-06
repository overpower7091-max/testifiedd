// Balanced random pick across a student's selected syllabus topics.
export const MIXED_PREFIX = "mixed-";
export const MIXED_MIN = 15;
export const MIXED_MAX = 20;

export function clampMixedCount(n: number) {
  return Math.min(MIXED_MAX, Math.max(MIXED_MIN, Math.round(n || MIXED_MIN)));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Round-robin over shuffled topic pools so every selected topic gets a fair, random share. */
export function pickMixed<T>(poolsByTopic: Record<string, T[]>, total: number): T[] {
  const pools = shuffle(Object.values(poolsByTopic).filter((p) => p.length)).map((p) => shuffle(p));
  const out: T[] = [];
  let progressed = true;
  while (out.length < total && progressed) {
    progressed = false;
    for (const p of pools) {
      if (out.length >= total) break;
      const q = p.pop();
      if (q !== undefined) { out.push(q); progressed = true; }
    }
  }
  return shuffle(out);
}
