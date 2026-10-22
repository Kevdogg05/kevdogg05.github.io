import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PanelProps {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ icon: Icon, title, aside, className = "", children }: PanelProps) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 shadow-sm shadow-black/20 ${className}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-100">
          <Icon className="size-4 text-violet-400" aria-hidden />
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
