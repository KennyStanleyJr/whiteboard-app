import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function withQueryClient(ui: ReactElement): ReactElement {
  return (
    <QueryClientProvider client={defaultQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}
