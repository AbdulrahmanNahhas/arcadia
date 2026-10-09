import { CSPProvider } from "@base-ui/react/csp-provider";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app";

import "./styles/tailwind.css";
import "./styles/client.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 60000, refetchOnWindowFocus: false } },
});
const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <CSPProvider disableStyleElements>
        <DirectionProvider direction="rtl">
          <App />
        </DirectionProvider>
      </CSPProvider>
    </QueryClientProvider>
  </StrictMode>,
);
