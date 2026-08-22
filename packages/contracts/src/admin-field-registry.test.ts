import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  adminAwardCeremonyInputSchema,
  adminEpisodeInputSchema,
  adminInstallmentInputSchema,
  adminTitleInputSchema,
} from "./admin-catalog";
import { type AdminFieldEntity, adminFieldRegistry } from "./admin-field-registry";
import { adminAwardRecognitionInputSchema } from "./index";

/**
 * Cross-checks `adminFieldRegistry` against the real Zod schemas it describes, so the registry
 * (widget kind, required/nullable, static enum values) can't silently drift from the schemas
 * that actually validate admin writes. This intentionally does NOT try to derive the registry
 * from the schemas (or vice versa) — see the design note at the top of
 * `admin-field-registry.ts` for why they're kept as two small, independently-authored sources
 * that this test reconciles, rather than one deriving the other.
 *
 * Scope: only registry entries whose `zodPath` is a single segment (a direct key on the
 * entity's own input schema) are checked here — that covers the large majority of entries. A
 * handful of nested nested (installment-override, episode) paths are still single-segment
 * relative to their own entity schema (e.g. `adminInstallmentInputSchema.shape.ageOverride`), so
 * this covers those too; only genuinely multi-level paths would need deeper unwrapping, and none
 * are registered yet.
 */

const schemaByEntity = {
  title: adminTitleInputSchema,
  installment: adminInstallmentInputSchema,
  episode: adminEpisodeInputSchema,
  "award-recognition": adminAwardRecognitionInputSchema,
  "award-ceremony": adminAwardCeremonyInputSchema,
} satisfies Partial<Record<AdminFieldEntity, z.ZodObject>>;

function hasRegisteredSchema(entity: AdminFieldEntity): entity is keyof typeof schemaByEntity {
  return entity in schemaByEntity;
}

/**
 * Looks up a shape key on an entity's root schema. `rootSchema` is a union of the (differently
 * shaped) entity schemas above, so its `shape` fields are only known to be `z.ZodObject`'s
 * default, erased shape — TypeScript can't correlate a runtime string `key` against that union's
 * literal keys.
 */
function fieldSchemaAt(rootSchema: z.ZodObject, key: string): z.ZodTypeAny | undefined {
  const fields = rootSchema["shape"];
  // SAFETY: every value produced by `z.object(...)` (the classic API used to build every schema
  // in `schemaByEntity`) is itself a classic `ZodTypeAny` with a working `safeParse`; the erasure
  // to `core.$ZodType` here is a structural artifact of typing `rootSchema` as the unparameterized
  // `z.ZodObject` so it can hold several concrete entity schemas in one union, not an actual
  // runtime difference.
  return (fields as Record<string, z.ZodTypeAny>)[key];
}

const stringArraySchema = z.array(z.string());

type UnwrappableSchema =
  | z.ZodOptional
  | z.ZodNullable
  | z.ZodDefault
  | z.ZodPrefault
  | z.ZodNonOptional
  | z.ZodCatch
  | z.ZodSuccess;

function isUnwrappableSchema(schema: z.core.$ZodType): schema is UnwrappableSchema {
  return (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodPrefault ||
    schema instanceof z.ZodNonOptional ||
    schema instanceof z.ZodCatch ||
    schema instanceof z.ZodSuccess
  );
}

function unwrapToEnumOptions(schema: z.ZodTypeAny): readonly string[] | null {
  let current: z.core.$ZodType = schema;
  for (let depth = 0; depth < 8; depth += 1) {
    if (current instanceof z.ZodEnum) {
      const parsedOptions = stringArraySchema.safeParse(current.options);
      return parsedOptions.success ? parsedOptions.data : null;
    }
    if (!isUnwrappableSchema(current)) return null;
    current = current.unwrap();
  }
  return null;
}

describe("adminFieldRegistry cross-check", () => {
  for (const field of adminFieldRegistry) {
    if (field.zodPath.length !== 1) continue;
    if (!hasRegisteredSchema(field.entity)) continue;
    const rootSchema = schemaByEntity[field.entity];

    it(`${field.path} matches its schema field`, () => {
      const key = field.zodPath[0];
      expect(key, `${field.path} has an empty zodPath`).toBeDefined();
      if (key === undefined) return;
      const fieldSchema = fieldSchemaAt(rootSchema, key);
      expect(fieldSchema, `no field "${key}" on ${field.entity} schema`).toBeDefined();
      if (!fieldSchema) return;

      const acceptsUndefined = fieldSchema.safeParse(undefined).success;
      const acceptsNull = fieldSchema.safeParse(null).success;
      expect(!acceptsUndefined, `required mismatch for ${field.path}`).toBe(field.required);
      expect(acceptsNull, `nullable mismatch for ${field.path}`).toBe(field.nullable);

      if (field.options?.type !== "static") return;
      const actual = unwrapToEnumOptions(fieldSchema);
      expect(actual, `expected ${field.path} to resolve to a static enum`).not.toBeNull();
      expect(new Set(actual)).toEqual(new Set(field.options.values));
    });
  }

  it("every registered path is unique", () => {
    const paths = adminFieldRegistry.map((field) => field.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("covers every field on adminTitleInputSchema except relation/list fields modeled elsewhere", () => {
    const covered = new Set(
      adminFieldRegistry
        .filter((field) => field.entity === "title")
        .map((field) => field.zodPath[0]),
    );
    const fields = adminTitleInputSchema["shape"];
    const intentionallyUncovered = new Set([
      "id",
      "contributors",
      "relations",
      "externalIdentities",
      "imagePath",
      "bannerPath",
      "logoPath",
      "initialInstallment",
    ]);
    for (const key of Object.keys(fields)) {
      if (intentionallyUncovered.has(key)) continue;
      expect(covered.has(key), `title.${key} has no adminFieldRegistry entry`).toBe(true);
    }
  });
});
