import type { MetadataRoute } from "next";

/**
 * Lets her keep Mon Amour on the home screen and open it without Safari's
 * chrome — the pink heart, the greeting, then her wardrobe, like an app.
 *
 * On iOS this is applied via Share → Add to Home Screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mon Amour",
    short_name: "Mon Amour",
    description: "Everything she loves, gathered in one place.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8FB",
    theme_color: "#FFF8FB",
    categories: ["shopping", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
