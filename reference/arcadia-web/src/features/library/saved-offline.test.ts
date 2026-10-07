import type { AccountTitleState, TitleDetail } from "@arcadia/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTitleSavedOffline, syncTitleOfflineCache } from "./saved-offline";

function buildDependencies() {
  return {
    getTitle: vi.fn<(titleId: string) => Promise<TitleDetail | null>>(),
    removeTitleOffline: vi.fn<(titleId: string) => Promise<void>>(),
    saveTitleOffline: vi.fn<(detail: TitleDetail) => Promise<void>>(),
    updateTitleState:
      vi.fn<(titleId: string, input: Partial<AccountTitleState>) => Promise<AccountTitleState>>(),
  };
}

describe("saved offline titles", () => {
  let dependencies: ReturnType<typeof buildDependencies>;

  beforeEach(() => {
    dependencies = buildDependencies();
  });

  it("caches the full title detail before marking it saved", async () => {
    // SAFETY: only `id` is read by setTitleSavedOffline/syncTitleOfflineCache; the rest of
    // TitleDetail is irrelevant to this dependency-passthrough test.
    const detail = { id: "title-1" } as TitleDetail;
    dependencies.getTitle.mockResolvedValue(detail);

    await setTitleSavedOffline("title-1", true, dependencies);

    expect(dependencies.saveTitleOffline).toHaveBeenCalledWith(detail);
    expect(dependencies.updateTitleState).toHaveBeenCalledWith("title-1", { savedOffline: true });
  });

  it("removes the device cache before clearing the saved state", async () => {
    await setTitleSavedOffline("title-1", false, dependencies);

    expect(dependencies.removeTitleOffline).toHaveBeenCalledWith("title-1");
    expect(dependencies.getTitle).not.toHaveBeenCalled();
    expect(dependencies.updateTitleState).toHaveBeenCalledWith("title-1", {
      savedOffline: false,
    });
  });

  it("can clear the device cache while another library mutation updates the server", async () => {
    await syncTitleOfflineCache("title-1", false, dependencies);

    expect(dependencies.removeTitleOffline).toHaveBeenCalledWith("title-1");
    expect(dependencies.updateTitleState).not.toHaveBeenCalled();
  });
});
