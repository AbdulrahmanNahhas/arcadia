import { describe, expect, it } from "vitest";
import { createDefaultViewState, decodeViewState, encodeViewState } from "./library-state";

describe("library URL state", () => {
  it("round-trips filters, grouping, sorting, and display options", () => {
    const state = createDefaultViewState();
    state.search = "غموض";
    state.layout = "wide";
    state.sort = "depth";
    state.groupBy = "rating";
    state.filters.favoriteOnly = true;
    state.filters.facets.genres.include = ["Mystery"];
    state.tableColumns = ["title", "depth", "craft"];

    expect(decodeViewState(encodeViewState(state))).toEqual(state);
  });

  it("ignores malformed URL state", () => {
    expect(decodeViewState("not-json")).toBeNull();
  });
});
