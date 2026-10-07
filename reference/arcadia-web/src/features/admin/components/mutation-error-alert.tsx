import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";

/**
 * Renders a mutation's error, expanding structured Zod `issues` (path + message per field) when
 * the API returned them, instead of collapsing everything to one flat sentence. Used everywhere
 * an admin write mutation surfaces its error — awards, catalog, and beyond.
 */
export function MutationErrorAlert({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  const issues = error instanceof ApiError ? error.issues : undefined;
  return (
    <Alert variant="destructive">
      <AlertTitle>{error.message}</AlertTitle>
      {issues?.length ? (
        <AlertDescription>
          <ul className="list-inside list-disc">
            {issues.map((issue) => (
              <li key={`${issue.path.join(".")}:${issue.message}`}>
                {issue.path.length ? (
                  <code dir="ltr" className="me-1">
                    {issue.path.join(".")}
                  </code>
                ) : null}
                {issue.message}
              </li>
            ))}
          </ul>
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
