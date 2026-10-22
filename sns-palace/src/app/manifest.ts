import type { MetadataRoute } from "next";

// Makes SnS Palace installable: "Add to Home Screen" gives the castle icon,
// and the app opens on its own, without the browser's address bar.
// Icons live in public/icons/ (maskable ones keep the castle inside the
// circle Android launchers crop to); iPhone and iPad use app/apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SnS Palace",
    short_name: "SnS Palace",
    description: "Our family's private video studio.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f0ff",
    theme_color: "#7c3aed",
    categories: ["kids", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
