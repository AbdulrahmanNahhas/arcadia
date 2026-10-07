import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeEditorError } from "./errors";

const recordSchema = z.object({
  records: z.array(
    z.object({
      work: z.object({
        id: z.string(),
        country: z.array(z.enum(["Japan", "France"])),
        releaseYear: z.number().int(),
      }),
    }),
  ),
});

describe("describeEditorError", () => {
  it("names the offending value, the allowed options, and where it sits in the text", () => {
    const text = JSON.stringify(
      { records: [{ work: { id: "a", country: ["Japan", "Germany"], releaseYear: 2001 } }] },
      null,
      2,
    );
    const result = recordSchema.safeParse(JSON.parse(text));
    if (result.success) throw new Error("expected a Zod error");
    const described = describeEditorError(result.error, text);
    expect(described.summary).toContain("مشكلة واحدة");
    const [issue] = described.issues;
    expect(issue?.path).toBe("records › 0 › work › country › 1");
    expect(issue?.message).toContain("«Germany»");
    expect(issue?.message).toContain("«Japan»، «France»");
    expect(issue?.range).not.toBeNull();
    expect(text.slice(issue?.range?.[0], issue?.range?.[1])).toBe('"Germany"');
  });

  it("finds a value even when the schema's path is relative to one record", () => {
    const text = JSON.stringify({
      records: [{ work: { id: "a", country: ["Mars"], releaseYear: 1 } }],
    });
    const result = z
      .object({ country: z.array(z.enum(["Japan"])) })
      .safeParse({ country: ["Mars"] });
    if (result.success) throw new Error("expected a Zod error");
    const described = describeEditorError(result.error, text);
    expect(described.issues[0]?.message).toContain("«Mars»");
  });

  it("points a syntax error at its line", () => {
    const text = '{\n  "a": 1,\n  "b": \n}';
    let caught: SyntaxError | null = null;
    try {
      JSON.parse(text);
    } catch (error) {
      caught = error instanceof SyntaxError ? error : null;
    }
    if (!caught) throw new Error("expected a syntax error");
    const described = describeEditorError(caught, text);
    expect(described.summary).toContain("JSON غير صالح");
    expect(described.summary).toMatch(/السطر [34]/);
  });
});
