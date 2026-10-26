import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SnS Palace", template: "%s · SnS Palace" },
  description: "Our family's private video studio.",
  applicationName: "SnS Palace",
  robots: { index: false, follow: false },
  // On iPhone and iPad, "Add to Home Screen" opens it like an app (see manifest.ts).
  appleWebApp: { capable: true, title: "SnS Palace", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full bg-white font-sans text-slate-800">{children}</body>
    </html>
  );
}
