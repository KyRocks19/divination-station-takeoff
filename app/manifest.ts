import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Divination Station",
    short_name: "Divination Station",
    description: "A private place to learn and practise divination",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d1a",
    theme_color: "#7c3aed",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["lifestyle", "utilities"],
  };
}
