import { ResponsiveShell } from "../../components/ResponsiveShell";

export default function HomeLoading() {
  return (
    <ResponsiveShell nav="home">
      <div className="screen screen-has-nav px-5 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-5 w-28 animate-pulse rounded bg-surface-subtle" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-16 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-surface-subtle" />
          </div>
        </div>
        <div className="mt-8 h-10 w-40 animate-pulse rounded bg-surface-subtle" />
        <div className="mt-2 h-12 w-56 animate-pulse rounded bg-surface-subtle" />
        <div className="mt-6 flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-11 flex-1 animate-pulse rounded-full bg-surface-subtle"
            />
          ))}
        </div>
        <div className="mt-7 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex shrink-0 flex-col items-center gap-2">
              <div className="h-[52px] w-[52px] animate-pulse rounded-full bg-surface-subtle" />
              <div className="h-3 w-10 animate-pulse rounded bg-surface-subtle" />
            </div>
          ))}
        </div>
      </div>
    </ResponsiveShell>
  );
}
