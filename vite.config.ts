/// <reference types="vitest/config" />
import path from "path";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

/** Redirect /docs to /docs/ so both work. */
function redirectDocsMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const url = req.url?.split("?")[0] ?? "";
  if (url === "/docs") {
    res.writeHead(302, { Location: "/docs/" });
    res.end();
    return;
  }
  next();
}

/** In dev, serve built docs at /docs and /docs/ (production uses static dist/docs/). */
function docsPlugin() {
  return {
    name: "docs-fallback",
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(redirectDocsMiddleware);
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/docs/") {
          const indexPath = path.resolve(process.cwd(), "public/docs/index.html");
          if (fs.existsSync(indexPath)) {
            res.setHeader("Content-Type", "text/html");
            res.statusCode = 200;
            res.end(fs.readFileSync(indexPath, "utf-8"));
            return;
          }
        }
        next();
      });
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
        stack?: Array< { route: string; handle: (req: IncomingMessage, res: ServerResponse, next: () => void) => void } >;
      };
    }) {
      // Run redirect before static file server so /docs is redirected to /docs/
      const stack = (server.middlewares as { stack?: Array<{ route: string; handle: (req: IncomingMessage, res: ServerResponse, next: () => void) => void }> }).stack;
      if (Array.isArray(stack)) {
        stack.unshift({ route: "", handle: redirectDocsMiddleware });
      } else {
        server.middlewares.use(redirectDocsMiddleware);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    docsPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "apple-touch-icon-180x180.png",
      ],
      manifest: {
        name: "Whiteboard",
        short_name: "Whiteboard",
        description:
          "Infinite whiteboard for text, images, videos, links, post-it notes, and arrows.",
        theme_color: "#f5f5f5",
        background_color: "#f5f5f5",
        display: "standalone",
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
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
