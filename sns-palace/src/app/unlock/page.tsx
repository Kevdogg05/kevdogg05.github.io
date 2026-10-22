import type { Metadata } from "next";
import { Suspense } from "react";
import { PinPad } from "@/components/PinPad";

export const metadata: Metadata = { title: "Unlock" };

export default function UnlockPage() {
  return (
    // The PIN pad reads ?mode and ?next, which are only known per request.
    <Suspense fallback={<main className="kid-sky min-h-screen" />}>
      <PinPad />
    </Suspense>
  );
}
