import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ParsedMCQ = {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
};

const SYSTEM_PROMPT = `You convert raw study text into structured MCQs for a quiz database.

Rules:
- Output ONLY valid JSON. No prose. No markdown fences.
- Shape: { "questions": [ { "question": string, "options": [string,string,string,string], "correct": 0|1|2|3, "explanation": string, "difficulty": "easy"|"medium"|"hard" } ] }
- Always exactly 4 options. "correct" is a 0-based index.
- Preserve original language (Bengali/English/mixed) exactly as given.
- Render ALL mathematical expressions and chemical formulas/equations using LaTeX:
  * inline: $...$   e.g. $P = \\dfrac{F}{A}$, $H_2SO_4$, $2H_2 + O_2 \\rightarrow 2H_2O$
  * block: $$...$$ only for long derivations
  * subscripts with _{}, superscripts with ^{}, arrows \\rightarrow, \\leftrightarrow, states (aq),(s),(l),(g) as plain text
- If the source marks the answer (e.g. "Ans: B", "উত্তর: ২", "✓", bold option), map it to the correct index. If ambiguous, pick the best answer.
- If explanation is missing, write a brief one (1-2 sentences) in the same language.
- Infer difficulty from complexity; default "medium".
- Deduplicate. Skip malformed items rather than inventing content.`;

export const parseMCQs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => {
    if (!data?.text || typeof data.text !== "string") throw new Error("text required");
    if (data.text.length > 60000) throw new Error("Text too long (max 60k chars)");
    return data;
  })
  .handler(async ({ data }): Promise<{ questions: ParsedMCQ[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { questions: [] };
    }
    const questions: ParsedMCQ[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const clean = questions
      .filter((q) => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4)
      .map((q) => ({
        question: String(q.question).trim(),
        options: q.options.map((o) => String(o ?? "").trim()),
        correct: Math.max(0, Math.min(3, Number(q.correct) || 0)),
        explanation: q.explanation ? String(q.explanation).trim() : "",
        difficulty: (["easy", "medium", "hard"].includes(String(q.difficulty)) ? q.difficulty : "medium") as ParsedMCQ["difficulty"],
      }));
    return { questions: clean };
  });
