/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { exportedForTesting, notebookAtom } from "../../cells/cells";
import { CellId } from "../../cells/ids";
import { createCellRuntimeState } from "../../cells/types";
import { canShowCachedOutputsAtom } from "../capabilities";

const { initialNotebookState } = exportedForTesting;

function plainOutput(data: string) {
  return {
    channel: "output" as const,
    mimetype: "text/plain" as const,
    data,
    timestamp: 0,
  };
}

describe("canShowCachedOutputsAtom", () => {
  it("is false when there are no cells", () => {
    const store = createStore();
    store.set(notebookAtom, initialNotebookState());
    expect(store.get(canShowCachedOutputsAtom)).toBe(false);
  });

  it("is false when every cell has empty output", () => {
    const store = createStore();
    const cellId = CellId.create();
    store.set(notebookAtom, {
      ...initialNotebookState(),
      cellRuntime: { [cellId]: createCellRuntimeState({ output: null }) },
    });
    expect(store.get(canShowCachedOutputsAtom)).toBe(false);
  });

  it("is true when at least one cell has a non-empty output", () => {
    const store = createStore();
    const cellId = CellId.create();
    store.set(notebookAtom, {
      ...initialNotebookState(),
      cellRuntime: {
        [cellId]: createCellRuntimeState({ output: plainOutput("hello") }),
      },
    });
    expect(store.get(canShowCachedOutputsAtom)).toBe(true);
  });
});
