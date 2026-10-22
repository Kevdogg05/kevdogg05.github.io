import type { Metadata } from "next";
import { ReviewBoard } from "@/components/parent/ReviewBoard";

export const metadata: Metadata = { title: "Parent review" };

// The proxy only lets a parent session reach this page, and every API call the
// board makes re-checks it, so the static shell itself holds no data.
export default function ParentPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ReviewBoard />
    </div>
  );
}
