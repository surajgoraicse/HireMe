import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"
import manifest from "./manifest.config.ts"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  server: {
    ws: {
      host: "localhost",
      port: 5173,
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress the 'unknown option' warning for platform if it comes from a plugin
        if (
          warning.code === "UNKNOWN_OPTION" &&
          warning.message?.includes("platform")
        ) {
          return
        }
        warn(warning)
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
