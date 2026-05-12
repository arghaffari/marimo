/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { kernelStateAtom } from "../../kernel/state";
import { connectionAtom } from "../../network/connection";
import {
  runtimeAdapterAtom,
  staticAdapter,
  wasmAdapter,
} from "../../runtime/adapter";
import { wasmInitStatusAtom } from "../../wasm/state";
import { WebSocketState } from "../../websocket/types";
import {
  canMutateUIElementsAtom,
  canRunCellsAtom,
  canShowCellsAtom,
} from "../capabilities";
import { lifecyclePhaseAtom } from "../phase";

// Integration tests that exercise the live derived atoms — not the pure
// projections. Verifies the wiring from primary signals through the
// runtime adapter, into the phase, and out to capability atoms.

describe("lifecyclePhaseAtom (remote runtime)", () => {
  // The default adapter in test env is "remote" (no marimo-wasm DOM element).
  it("derives boot → kernel-ready as primary signals advance", () => {
    const store = createStore();
    // boot: no cells, NOT_STARTED.
    expect(store.get(lifecyclePhaseAtom)).toBe("boot");

    // connecting once WS dials.
    store.set(connectionAtom, { state: WebSocketState.CONNECTING });
    expect(store.get(lifecyclePhaseAtom)).toBe("runtime-connecting");

    // runtime-ready once WS open but kernel not yet acked.
    store.set(connectionAtom, { state: WebSocketState.OPEN });
    expect(store.get(lifecyclePhaseAtom)).toBe("runtime-ready");

    // kernel-ready once kernel ack'd.
    store.set(kernelStateAtom, { isInstantiated: true, error: null });
    expect(store.get(lifecyclePhaseAtom)).toBe("kernel-ready");
  });
});

describe("lifecyclePhaseAtom respects adapter kind", () => {
  it("static notebooks skip the kernel phases", () => {
    const store = createStore();
    store.set(runtimeAdapterAtom, staticAdapter);
    // Default: no cells → boot.
    expect(store.get(lifecyclePhaseAtom)).toBe("boot");
  });

  it("WASM uses wasmInitStatusAtom, not connectionAtom", () => {
    const store = createStore();
    store.set(runtimeAdapterAtom, wasmAdapter);
    // WS state should be ignored in WASM mode.
    store.set(connectionAtom, { state: WebSocketState.OPEN });
    store.set(wasmInitStatusAtom, "loading");
    expect(store.get(lifecyclePhaseAtom)).toBe("boot");

    store.set(wasmInitStatusAtom, "ready");
    // No cells yet — runtime-ready.
    expect(store.get(lifecyclePhaseAtom)).toBe("runtime-ready");
  });
});

describe("capability atoms react to phase changes", () => {
  it("canRunCellsAtom flips true at kernel-ready", () => {
    const store = createStore();
    expect(store.get(canRunCellsAtom)).toBe(false);

    store.set(connectionAtom, { state: WebSocketState.OPEN });
    store.set(kernelStateAtom, { isInstantiated: true, error: null });
    expect(store.get(canRunCellsAtom)).toBe(true);
  });

  it("canMutateUIElementsAtom waits for interactive (only WASM/static/islands hit it from these primary signals)", () => {
    const store = createStore();
    // Remote runtime never reaches "interactive" via the primary signals in this test
    // — that transition is driven by RuntimeState.completedCellRunEvent etc. So we
    // verify it stays false for the same store that already hit kernel-ready.
    store.set(connectionAtom, { state: WebSocketState.OPEN });
    store.set(kernelStateAtom, { isInstantiated: true, error: null });
    expect(store.get(canMutateUIElementsAtom)).toBe(false);
  });

  it("canShowCellsAtom is just a re-export of hasCellsAtom", async () => {
    const { hasCellsAtom } = await import("../../cells/cells");
    expect(canShowCellsAtom).toBe(hasCellsAtom);
  });
});
