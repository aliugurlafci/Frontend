import type { MetadataRoute } from "next";

/**
 * /manifest.webmanifest — lets the CRM be installed as a standalone app (handy
 * for the POS/stock screens on tablets). Colours mirror the dark glass theme in
 * globals.css so the splash and title bar match the app chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aula CRM",
    short_name: "Aula",
    description: "Inventory, point of sale and sales in one workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#070a10",
    theme_color: "#e41f07",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
