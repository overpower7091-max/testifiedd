import { describe, expect, it } from "vitest";
import { clampMixedCount, pickMixed } from "./mixed-practice";

const pool = (t: string, n: number) => Array.from({ length: n }, (_, i) => `${t}${i}`);

describe("mixed practice", () => {
  it("keeps session length between 15 and 20", () => {
    expect(clampMixedCount(5)).toBe(15);
    expect(clampMixedCount(30)).toBe(20);
    expect(clampMixedCount(20)).toBe(20);
  });

  it("spreads questions evenly across selected topics", () => {
    const out = pickMixed({ a: pool("a", 50), b: pool("b", 50), c: pool("c", 50), d: pool("d", 50) }, 20);
    expect(out).toHaveLength(20);
    for (const t of ["a", "b", "c", "d"]) expect(out.filter((q) => q.startsWith(t))).toHaveLength(5);
  });

  it("fills from bigger topics when one topic is small, without duplicates", () => {
    const out = pickMixed({ a: pool("a", 2), b: pool("b", 50) }, 15);
    expect(out).toHaveLength(15);
    expect(new Set(out).size).toBe(15);
  });
});
