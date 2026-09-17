import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Link2, Youtube, FileText, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Study Materials — Testified" },
      { name: "description", content: "Notes, PDFs, YouTube lessons and useful links picked for your class." },
      { property: "og:title", content: "Study Materials — Testified" },
      { property: "og:description", content: "Notes, PDFs, YouTube lessons and useful links picked for your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Materials,
});

const prettySize = (n?: number | null) => (!n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Materials() {
  const [level, setLevel] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return setLoading(false);
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("class").eq("id", userRes.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userRes.user.id),
      ]);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      if (!p?.class) return setLoading(false);
      setLevel(p.class);
      const { data } = await supabase
        .from("study_materials")
        .select("*")
        .eq("class_level", p.class)
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  const download = async (row: any) => {
    const { data, error } = await supabase.storage
      .from("study-materials")
      .createSignedUrl(row.file_path, 60 * 60, { download: row.file_name ?? true });
    if (error || !data) return toast.error(error?.message ?? "Could not open this file");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin={isAdmin} back={{ to: "/home" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Class {level || "—"}</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            Study <span className="gradient-text">materials</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Notes and PDFs you can download, plus video lessons and links.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full py-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="col-span-full glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
              No study materials for your class yet. Check back soon.
            </div>
          ) : (
            items.map((m) => (
              <div key={m.id} className="glass rounded-3xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl glass-tint text-primary">
                    {m.kind === "youtube" ? <Youtube className="h-5 w-5" /> : m.kind === "link" ? <Link2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.kind === "youtube" ? "Video" : m.kind === "link" ? "Link" : prettySize(m.file_size) || "File"}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.title}</div>
                  {m.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{m.description}</p>}
                </div>
                {m.kind === "file" ? (
                  <button onClick={() => download(m)} className="btn-gradient mt-auto inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-medium">
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                ) : (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gradient mt-auto inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {m.kind === "youtube" ? "Watch on YouTube" : "Open link"}
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
