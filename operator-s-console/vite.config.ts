import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// The console build is intentionally deterministic; stale Browserslist metadata
// should not create recurring warning noise during normal local or CI builds.
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";

function manualChunks(id: string) {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("/scheduler/") ||
    id.includes("/react-router/") ||
    id.includes("/react-router-dom/") ||
    id.includes("/@tanstack/")
  ) {
    return "vendor-runtime";
  }

  if (
    id.includes("/framer-motion/") ||
    id.includes("/recharts/") ||
    id.includes("/d3-") ||
    id.includes("/date-fns/")
  ) {
    return "vendor-insight";
  }

  if (
    id.includes("/@radix-ui/") ||
    id.includes("/cmdk/") ||
    id.includes("/vaul/") ||
    id.includes("/react-hook-form/") ||
    id.includes("/@hookform/") ||
    id.includes("/react-day-picker/") ||
    id.includes("/react-resizable-panels/") ||
    id.includes("/embla-carousel")
  ) {
    return "vendor-ui";
  }

  if (id.includes("/lucide-react/")) {
    return "vendor-icons";
  }

  return "vendor-misc";
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/operator/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
