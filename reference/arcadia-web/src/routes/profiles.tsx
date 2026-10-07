import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/profiles")({ component: () => <Navigate to="/accounts" /> });
