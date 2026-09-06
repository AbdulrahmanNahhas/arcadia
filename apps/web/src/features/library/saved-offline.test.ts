import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTitleSavedOffline, syncTitleOfflineCache } from "./saved-offline";

const mocks = vi.hoisted(() => ({
  getTitle: vi.fn(),
  removeTitleOffline: vi.fn(),
  saveTitleOffline: vi.fn(),
  updateTitleState: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ getTitle: mocks.getTitle }));
vi.mock("./offline-store", () => ({
  removeTitleOffline: mocks.removeTitleOffline,
  saveTitleOffline: mocks.saveTitleOffline,
}));
vi.mock("@/features/social/api", () => ({ updateTitleState: mocks.updateTitleState }));

describe("saved offline titles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches the full title detail before marking it saved", async () => {
    const detail = { id: "title-1" };
    mocks.getTitle.mockResolvedValue(detail);

    await setTitleSavedOffline("title-1", true);

    expect(mocks.saveTitleOffline).toHaveBeenCalledWith(detail);
    expect(mocks.updateTitleState).toHaveBeenCalledWith("title-1", { savedOffline: true });
  });

  it("removes the device cache before clearing the saved state", async () => {
    await setTitleSavedOffline("title-1", false);

    expect(mocks.removeTitleOffline).toHaveBeenCalledWith("title-1");
    expect(mocks.getTitle).not.toHaveBeenCalled();
    expect(mocks.updateTitleState).toHaveBeenCalledWith("title-1", { savedOffline: false });
  });

  it("can clear the device cache while another library mutation updates the server", async () => {
    await syncTitleOfflineCache("title-1", false);

    expect(mocks.removeTitleOffline).toHaveBeenCalledWith("title-1");
    expect(mocks.updateTitleState).not.toHaveBeenCalled();
  });
});
