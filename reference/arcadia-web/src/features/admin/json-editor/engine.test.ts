import { describe, expect, it } from "vitest";
import { diffAwards, type RecordAward } from "./engine";

function award(overrides: Partial<RecordAward> = {}): RecordAward {
  return {
    id: "award-1",
    organizationId: "org-1",
    categoryId: "cat-1",
    titleId: "title-1",
    installmentId: null,
    year: 2024,
    result: "nominee",
    isFeatured: false,
    sourceUrl: null,
    notes: null,
    ...overrides,
  };
}

describe("diffAwards", () => {
  it("treats an award whose id isn't in the original set as a create", () => {
    // mergeAwardsProjection always assigns a fresh id to new entries (via crypto.randomUUID())
    // before diffAwards ever runs — a "create" is identified by that id being absent from
    // `original`, not by an empty/missing id.
    const created = award({ id: "brand-new-id" });
    const { toCreate, toUpdate, toDeleteIds } = diffAwards([], [created]);
    expect(toCreate).toHaveLength(1);
    expect(toUpdate).toHaveLength(0);
    expect(toDeleteIds).toHaveLength(0);
    // The create payload must not carry the client-generated id — the server assigns the real one.
    expect(toCreate[0]?.id).toBeUndefined();
  });

  it("treats an award with a matching id and changed fields as an update", () => {
    const original = award({ id: "award-1", result: "nominee" });
    const desired = award({ id: "award-1", result: "winner" });
    const { toCreate, toUpdate, toDeleteIds } = diffAwards([original], [desired]);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0]?.result).toBe("winner");
    expect(toDeleteIds).toHaveLength(0);
  });

  it("leaves an unchanged award alone (neither create, update, nor delete)", () => {
    const same = award({ id: "award-1" });
    const { toCreate, toUpdate, toDeleteIds } = diffAwards([same], [{ ...same }]);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
    expect(toDeleteIds).toHaveLength(0);
  });

  it("treats an original award missing from the desired list as a delete", () => {
    const original = award({ id: "award-1" });
    const { toCreate, toUpdate, toDeleteIds } = diffAwards([original], []);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
    expect(toDeleteIds).toEqual(["award-1"]);
  });

  it("handles a mix of create, update, and delete in one diff", () => {
    const kept = award({ id: "keep", result: "nominee" });
    const changed = award({ id: "change", result: "nominee" });
    const removed = award({ id: "remove" });
    const original = [kept, changed, removed];
    const desired = [kept, award({ ...changed, result: "winner" }), award({ id: "new-one" })];
    const { toCreate, toUpdate, toDeleteIds } = diffAwards(original, desired);
    expect(toCreate.map((a) => a.notes)).toHaveLength(1);
    expect(toUpdate.map((a) => a.id)).toEqual(["change"]);
    expect(toDeleteIds).toEqual(["remove"]);
  });
});
