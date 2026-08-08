import { describe, expect, it } from "vitest";
import { audienceSchema, countrySchema, publicationSchema, workRelationInputSchema } from "./model";

describe("literature model", () => {
  it("accepts publication metadata without tracking progress", () => {
    expect(
      publicationSchema.parse({
        format: "Novel trilogy",
        publisher: "Tor Books",
        imprint: null,
        serialization: [],
        contents: ["Mistborn: The Final Empire", "The Well of Ascension", "The Hero of Ages"],
      }),
    ).toMatchObject({ format: "Novel trilogy", contents: expect.any(Array) });
  });

  it("accepts directed adaptation relationships", () => {
    expect(
      workRelationInputSchema.parse({
        workId: "literature-manga-blue-box",
        relationType: "adaptation",
        direction: "outgoing",
        notes: "",
      }),
    ).toMatchObject({ relationType: "adaptation", direction: "outgoing" });
  });

  it("uses the controlled audience and country vocabularies", () => {
    expect(audienceSchema.options).toEqual(["Adult", "Young Adult", "Teen", "General"]);
    expect(countrySchema.options).toEqual([
      "Australia",
      "Canada",
      "China",
      "France",
      "Japan",
      "Spain",
      "South Korea",
      "United Kingdom",
      "United States",
    ]);
  });
});
