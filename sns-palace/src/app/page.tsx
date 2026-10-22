import { Lock } from "lucide-react";
import Link from "next/link";
import { CastleLogo } from "@/components/CastleLogo";
import { KidDashboard } from "@/components/kid/KidDashboard";

export default function Home() {
  return (
    <div className="kid-sky min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:py-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow-lg motion-safe:animate-float sm:size-14">
            <CastleLogo className="size-11 sm:size-13" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-none font-bold whitespace-nowrap text-violet-700 sm:text-5xl">
              SnS Palace
            </h1>
            <p className="text-sm font-bold text-slate-500 sm:text-base">Our family&apos;s video studio</p>
          </div>
        </div>
        <Link
          href="/parent"
          aria-label="Grown-ups"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-bold whitespace-nowrap text-slate-600 shadow ring-2 ring-white transition hover:text-violet-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:px-4"
        >
          <Lock aria-hidden className="size-4" />
          <span className="hidden min-[360px]:inline">Grown-ups</span>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <KidDashboard />
      </main>
    </div>
  );
}
