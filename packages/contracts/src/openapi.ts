import type { BrowseResponse, TitleDetail } from ".";
export interface paths {
  "/api/v1/titles": {
    get: {
      parameters: { query?: Record<string, string | number> };
      responses: { 200: { content: { "application/json": BrowseResponse } } };
    };
  };
  "/api/v1/titles/{titleId}": {
    get: {
      parameters: { path: { titleId: string } };
      responses: {
        200: { content: { "application/json": TitleDetail } };
        404: { content: { "application/json": { message: string } } };
      };
    };
  };
  "/api/v1/planets": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": Array<{
              id: string;
              slug: string;
              nameAr: string;
              nameEn: string | null;
              icon: string;
              description: string;
            }>;
          };
        };
      };
    };
  };
}
