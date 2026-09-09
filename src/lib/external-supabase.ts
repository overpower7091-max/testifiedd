// Simple client for the external Supabase project.
// Publishable key — safe to keep in the codebase.
import { createClient } from "@supabase/supabase-js";

export const EXTERNAL_SUPABASE_URL = "https://hecqnhmfllvqipttbpxe.supabase.co";
export const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_zZIS1zHyR5PV7MLxGTtD_Q_G50BJTg1";

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // New-format keys are opaque strings, not bearer JWTs.
    if (headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

export const externalSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    global: { fetch: createSupabaseFetch(EXTERNAL_SUPABASE_PUBLISHABLE_KEY) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  },
);
