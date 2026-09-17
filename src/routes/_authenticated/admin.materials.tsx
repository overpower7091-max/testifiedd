import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Upload, Link2, Youtube, FileText, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/materials")({
  head: () => ({
    meta: [
      { title: "Study Materials — Admin | Testified" },
      { name: "description", content: "Upload class-wise study materials, YouTube videos and useful links for students." },
      { property: "og:title", content: "Study Materials — Admin | Testified" },
      { property: "og:description", content: "Upload class-wise study materials, YouTube videos and useful links for students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminMaterials,
});

const LEVELS = ["6", "7", "8", "9", "10", "11", "12"] as const;
type Kind = "file" | "youtube" | "link";

function AdminMaterials() {
  const [level, setLevel] = useState<string>("10");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("file");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (lv: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("study_materials")
      .select("*")
      .eq("class_level", lv as any)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load(level);
  }, [level]);

  const reset = () => {
    setTitle("");
    setDesc("");
    setUrl("");
    setFile(null);
  };

  const submit = async () => {
    if (!title.trim()) return toast.error("Add a title");
    if (kind === "file" && !file) return toast.error("Choose a file to upload");
    if (kind !== "file" && !url.trim()) return toast.error("Paste a link");
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_size: number | null = null;

      if (kind === "file" && file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `class-${level}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("study-materials").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw upErr;
        file_path = path;
        file_name = file.name;
        file_size = file.size;
      }

      const { error } = await supabase.from("study_materials").insert({
        class_level: level as any,
        title: title.trim(),
        description: desc.trim() || null,
        kind,
        url: kind === "file" ? null : url.trim(),
        file_path,
        file_name,
        file_size,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Study material added");
      reset();
      load(level);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (!confirm("Delete this study material?")) return;
    if (row.file_path) await supabase.storage.from("study-materials").remove([row.file_path]);
    const { error } = await supabase.from("study_materials").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load(level);
  };

  const openFile = async (row: any) => {
    const { data, error } = await supabase.storage.from("study-materials").createSignedUrl(row.file_path, 60 * 60, { download: row.file_name ?? true });
    if (error || !data) return toast.error(error?.message ?? "Could not open file");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen">
      <AppHeader isAdmin back={{ to: "/admin" }} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Study materials</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            Share <span className="gradient-text">resources</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Upload notes and PDFs, or add YouTube videos and useful links for a class.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                onClick={() => setLevel(lv)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${level === lv ? "btn-gradient" : "glass hover:text-primary"}`}
              >
                Class {lv}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 glass rounded-3xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Add for class {level}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["file", "youtube", "link"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${kind === k ? "btn-gradient" : "glass hover:text-primary"}`}
              >
                {k === "file" ? <Upload className="h-3.5 w-3.5" /> : k === "youtube" ? <Youtube className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {k === "file" ? "Upload file" : k === "youtube" ? "YouTube video" : "Other link"}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Chapter 3 notes)"
              className="glass-tint rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Short description (optional)"
              className="glass-tint rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {kind === "file" ? (
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="sm:col-span-2 glass-tint rounded-xl px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary/15 file:px-3 file:py-1 file:text-xs file:text-primary"
              />
            ) : (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={kind === "youtube" ? "https://youtube.com/watch?v=..." : "https://..."}
                className="sm:col-span-2 glass-tint rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
          </div>

          <button
            onClick={submit}
            disabled={saving}
            className="mt-4 btn-gradient rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add material
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Nothing added for class {level} yet.</div>
          ) : (
            items.map((m) => (
              <div key={m.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tint text-primary shrink-0">
                  {m.kind === "youtube" ? <Youtube className="h-5 w-5" /> : m.kind === "link" ? <Link2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.description || m.file_name || m.url}</div>
                </div>
                {m.kind === "file" ? (
                  <button onClick={() => openFile(m)} className="glass rounded-full p-2 hover:text-primary" aria-label="Download">
                    <Download className="h-4 w-4" />
                  </button>
                ) : (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="glass rounded-full p-2 hover:text-primary" aria-label="Open link">
                    <Link2 className="h-4 w-4" />
                  </a>
                )}
                <button onClick={() => remove(m)} className="glass rounded-full p-2 text-red-500 hover:scale-105 transition-transform" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
