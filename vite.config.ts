/// <reference types="vitest/config" />
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(process.env.VITEST !== "true" ? [tailwindcss()] : []),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("jszip")) return "jszip";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "lucide";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
}));
