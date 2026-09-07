// Server-only Web Push sender (Cloudflare Worker compatible).
import { buildPushPayload, type PushMessage, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function vapid(): VapidKeys | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.error("[push] VAPID keys are not configured");
    return null;
  }
  return { subject, publicKey, privateKey };
}

export type PushBody = { title: string; body: string; url?: string; tag?: string };

async function sendOne(sub: { id: string; endpoint: string; p256dh: string; auth: string }, keys: VapidKeys, body: PushBody) {
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
  const message: PushMessage = {
    data: JSON.stringify(body),
    options: { ttl: 600, urgency: "high", topic: body.tag?.slice(0, 32) },
  };
  const payload = await buildPushPayload(message, subscription, keys);
  const res = await fetch(sub.endpoint, payload as unknown as RequestInit);
  if (res.status === 404 || res.status === 410) {
    // Subscription is dead — clean it up.
    await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
    return false;
  }
  if (!res.ok) {
    console.error(`[push] send failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  return true;
}

/** Send a notification to every subscribed student of a class. */
export async function sendPushToClass(classLevel: string, body: PushBody) {
  const keys = vapid();
  if (!keys) return { sent: 0, total: 0 };

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("class_level", classLevel as any);

  if (!subs || subs.length === 0) return { sent: 0, total: 0 };

  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        return await sendOne(s as any, keys, body);
      } catch (e) {
        console.error("[push] error", e);
        return false;
      }
    }),
  );
  return { sent: results.filter(Boolean).length, total: subs.length };
}

/** Send a notification to a single user (all of their devices). */
export async function sendPushToUser(userId: string, body: PushBody) {
  const keys = vapid();
  if (!keys) return { sent: 0, total: 0 };
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return { sent: 0, total: 0 };
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        return await sendOne(s as any, keys, body);
      } catch {
        return false;
      }
    }),
  );
  return { sent: results.filter(Boolean).length, total: subs.length };
}
