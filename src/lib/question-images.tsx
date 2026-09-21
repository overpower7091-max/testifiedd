import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const QUESTION_IMAGES_BUCKET = "question-images";

const cache = new Map<string, string>();

function isAbsolute(p: string) {
  return /^https?:\/\//i.test(p);
}

/** Resolve stored image references (storage paths or absolute URLs) to displayable URLs. */
export async function resolveQuestionImages(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const needed = paths.filter((p) => !isAbsolute(p) && !cache.has(p));
  if (needed.length) {
    const { data } = await supabase.storage
      .from(QUESTION_IMAGES_BUCKET)
      .createSignedUrls(needed, 60 * 60 * 6);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) cache.set(row.path, row.signedUrl);
    }
  }
  return paths.map((p) => (isAbsolute(p) ? p : (cache.get(p) ?? ""))).filter(Boolean);
}

export async function uploadQuestionImage(file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `q/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage
    .from(QUESTION_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

export function useQuestionImageUrls(paths: string[] | null | undefined) {
  const key = (paths ?? []).join("|");
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    if (!key) {
      setUrls([]);
      return;
    }
    resolveQuestionImages(key.split("|"))
      .then((u) => alive && setUrls(u))
      .catch(() => alive && setUrls([]));
    return () => {
      alive = false;
    };
  }, [key]);
  return urls;
}

/** Renders the images attached to a question, if any. */
export function QuestionImages({
  paths,
  className = "",
}: {
  paths: string[] | null | undefined;
  className?: string;
}) {
  const urls = useQuestionImageUrls(paths);
  if (!urls.length) return null;
  return (
    <div className={`mt-3 flex flex-wrap gap-2 ${className}`}>
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
          <img
            src={u}
            alt="Question illustration"
            loading="lazy"
            className="max-h-64 rounded-xl border border-border/50 object-contain bg-background/40"
          />
        </a>
      ))}
    </div>
  );
}
