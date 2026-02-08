import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

function bootstrap(): void {
  // In production, the server may serve this SPA for /docs; redirect so /docs/ is requested and docs can be served.
  if (typeof window !== "undefined" && window.location.pathname === "/docs") {
    window.location.replace("/docs/");
    return;
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });

  const rootEl = document.getElementById("root");
  if (rootEl == null) {
    throw new Error("Root element #root not found.");
  }
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
}

bootstrap();
