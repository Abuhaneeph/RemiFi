import { ResponsiveShell } from "../../components/ResponsiveShell";

export default function ProfileLoading() {
  return (
    <ResponsiveShell>
      <div className="screen px-5 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-5 w-24 animate-pulse rounded bg-surface-subtle" />
          <div className="w-10" />
        </div>
        <div className="mt-8 flex flex-col items-center">
          <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-surface-subtle" />
          <div className="mt-4 h-6 w-32 animate-pulse rounded bg-surface-subtle" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-surface-subtle" />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-surface-subtle"
            />
          ))}
        </div>
      </div>
    </ResponsiveShell>
  );
}
