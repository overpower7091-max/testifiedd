import { cn } from "@/lib/utils";

function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-bone", className)} />;
}

function HeaderSkeleton({ back = false }: { back?: boolean }) {
  return (
    <header className="relative z-30 px-4 pt-4 sm:px-6 lg:px-10">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          {back && <Bone className="h-8 w-8 rounded-full" />}
          <Bone className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5"><Bone className="h-4 w-20" /><Bone className="h-2 w-11" /></div>
        </div>
        <div className="flex items-center gap-2"><Bone className="h-8 w-10 rounded-full sm:w-16" /><Bone className="h-8 w-10 rounded-full sm:w-20" /><Bone className="h-8 w-16 rounded-full sm:w-24" /></div>
      </div>
    </header>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen w-full text-foreground" role="status" aria-label="Loading dashboard">
      <HeaderSkeleton />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass-strong relative min-h-[296px] overflow-hidden rounded-3xl p-6 sm:p-8 lg:col-span-2">
            <Bone className="h-3 w-24" /><Bone className="mt-3 h-10 w-4/5 max-w-xl sm:h-12" /><Bone className="mt-3 h-4 w-64 max-w-full" />
            <div className="mt-6 flex gap-3"><Bone className="h-10 w-36 rounded-full" /><Bone className="h-10 w-36 rounded-full" /></div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-[53px] rounded-2xl" />)}</div>
          </div>
          <div className="glass-strong min-h-[296px] rounded-3xl p-6">
            <div className="flex justify-between"><div className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-5 w-32" /></div><Bone className="h-6 w-12 rounded-full" /></div>
            <div className="mt-5 flex items-center gap-5"><Bone className="h-24 w-24 shrink-0 rounded-full" /><div className="flex-1 space-y-3"><Bone className="h-8 w-20" /><Bone className="h-3 w-32 max-w-full" /><Bone className="h-3 w-16" /></div></div>
            <div className="mt-5 grid grid-cols-2 gap-2"><Bone className="h-9 rounded-xl" /><Bone className="h-9 rounded-xl" /></div>
          </div>
        </section>
        <section className="mt-4"><Bone className="h-20 w-full rounded-3xl" /></section>
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass rounded-3xl p-6 lg:col-span-2"><div className="flex justify-between"><Bone className="h-5 w-32" /><Bone className="h-3 w-12" /></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="min-h-[180px] rounded-3xl" />)}</div></div>
          <div className="glass rounded-3xl p-6"><Bone className="h-5 w-28" /><div className="mt-4 space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-[52px] rounded-2xl" />)}</div></div>
        </section>
        <section className="mt-6"><div className="glass rounded-3xl p-6"><div className="flex justify-between"><Bone className="h-5 w-32" /><Bone className="h-3 w-12" /></div><div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Bone key={i} className="h-16 rounded-2xl" />)}</div></div></section>
      </main>
    </div>
  );
}

export function PracticeSkeleton() {
  return (
    <div className="min-h-screen" role="status" aria-label="Loading practice questions">
      <HeaderSkeleton back />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between"><Bone className="h-3 w-24" /><Bone className="h-3 w-12" /></div>
        <Bone className="mt-2 h-1.5 w-full rounded-full" />
        <div className="glass-strong mt-6 min-h-[470px] rounded-3xl p-6 sm:p-8">
          <Bone className="h-3 w-36" /><Bone className="mt-4 h-6 w-full" /><Bone className="mt-2 h-6 w-3/4" />
          <div className="mt-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-[52px] w-full rounded-2xl" />)}</div>
          <div className="mt-6 flex justify-end"><Bone className="h-10 w-24 rounded-full" /></div>
        </div>
      </main>
    </div>
  );
}

export function LoadedPage({ children }: { children: React.ReactNode }) {
  return <div className="page-content-enter">{children}</div>;
}
