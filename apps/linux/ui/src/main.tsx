import { CSPProvider } from "@base-ui/react/csp-provider";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router, queryClient } from "./app/router";
import { TooltipProvider } from "./components/ui/tooltip";

import "./styles/tailwind.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CSPProvider disableStyleElements>
        <DirectionProvider direction="rtl">
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </DirectionProvider>
      </CSPProvider>
    </QueryClientProvider>
  </StrictMode>,
);
