import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: the VAPID application server public key the browser needs to subscribe. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? null };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; user_agent?: string }) => {
    if (!d?.endpoint || !d.p256dh || !d.auth) throw new Error("Invalid subscription");
    if (d.endpoint.length > 2000) throw new Error("Invalid endpoint");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("class")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        class_level: (profile?.class ?? null) as any,
        user_agent: data.user_agent?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });
