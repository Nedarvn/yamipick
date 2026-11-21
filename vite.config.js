import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/yamipick/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "YamiPick",
        short_name: "YamiPick",
        description: "برنامه‌ریزی هوشمند وعده‌های غذایی",
        theme_color: "#fff3f1",
        background_color: "#fff3f1",
        display: "standalone",
        orientation: "portrait",
        start_url: "/yamipick/",
        icons: [
          {
            src: "/yamipick/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/yamipick/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
