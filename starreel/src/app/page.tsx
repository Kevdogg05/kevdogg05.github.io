import { Lock, Star } from "lucide-react";
import Link from "next/link";
import { KidDashboard } from "@/components/kid/KidDashboard";

export default function Home() {
  return (
    <div className="kid-sky min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:py-7">
        <div className="flex items-center gap-3">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow-lg motion-safe:animate-float">
            <Star aria-hidden className="size-8 fill-yellow-300 text-yellow-300" />
          </div>
          <div>
            <h1 className="font-display text-4xl leading-none font-bold text-violet-700 sm:text-5xl">StarReel</h1>
            <p className="font-bold text-slate-500">Our family&apos;s video studio</p>
          </div>
        </div>
        <Link
          href="/parent"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-slate-600 shadow ring-2 ring-white transition hover:text-violet-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          <Lock aria-hidden className="size-4" />
          Grown-ups
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <KidDashboard />
      </main>
    </div>
  );
}
