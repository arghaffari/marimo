/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { islandsInitializedAtom } from "../../islands/state";
import { connectionAtom } from "../../network/connection";
import {
  wasmInitErrorAtom,
  wasmInitializationAtom,
  wasmInitStatusAtom,
} from "../../wasm/state";
import { WebSocketState } from "../../websocket/types";
import {
  islandsAdapter,
  remoteAdapter,
  staticAdapter,
  wasmAdapter,
} from "../adapter";

describe("wasmAdapter", () => {
  it("reports connecting while loading, with the progress label", () => {
    const store = createStore();
    store.set(wasmInitStatusAtom, "loading");
    store.set(wasmInitializationAtom, "Loading Pyodide…");
    expect(store.get(wasmAdapter.phase)).toBe("connecting");
    expect(store.get(wasmAdapter.progress)).toEqual({
      label: "Loading Pyodide…",
    });
    expect(store.get(wasmAdapter.error)).toBeNull();
  });

  it("reports ready and clears progress when initialized", () => {
    const store = createStore();
    store.set(wasmInitStatusAtom, "ready");
    expect(store.get(wasmAdapter.phase)).toBe("ready");
    expect(store.get(wasmAdapter.progress)).toBeNull();
    expect(store.get(wasmAdapter.error)).toBeNull();
  });

  it("exposes the real error message (not the progress label) on failure", () => {
    const store = createStore();
    store.set(wasmInitStatusAtom, "error");
    store.set(wasmInitErrorAtom, "ImportError: numpy");
    store.set(wasmInitializationAtom, "Installing packages…");
    expect(store.get(wasmAdapter.phase)).toBe("failed");
    expect(store.get(wasmAdapter.error)).toEqual({
      message: "ImportError: numpy",
      kind: "init",
    });
  });

  it("uses a sensible fallback when error status is set but no message", () => {
    const store = createStore();
    store.set(wasmInitStatusAtom, "error");
    store.set(wasmInitErrorAtom, null);
    expect(store.get(wasmAdapter.error)?.message).toBe(
      "Pyodide failed to initialize",
    );
  });
});

describe("remoteAdapter", () => {
  it.each([
    [WebSocketState.OPEN, "ready"],
    [WebSocketState.CONNECTING, "connecting"],
    [WebSocketState.NOT_STARTED, "connecting"],
    [WebSocketState.CLOSED, "failed"],
    [WebSocketState.CLOSING, "failed"],
  ] as const)("maps WS %s to phase %s", (state, expected) => {
    const store = createStore();
    store.set(connectionAtom, { state } as never);
    expect(store.get(remoteAdapter.phase)).toBe(expected);
  });

  it("publishes a connecting label only while connecting", () => {
    const store = createStore();
    store.set(connectionAtom, { state: WebSocketState.CONNECTING });
    expect(store.get(remoteAdapter.progress)).toEqual({ label: "Connecting…" });

    store.set(connectionAtom, { state: WebSocketState.OPEN });
    expect(store.get(remoteAdapter.progress)).toBeNull();
  });

  it("surfaces the close reason as an error when closed", () => {
    const store = createStore();
    store.set(connectionAtom, {
      state: WebSocketState.CLOSED,
      code: "KERNEL_DISCONNECTED",
      reason: "Kernel went away",
    });
    expect(store.get(remoteAdapter.error)).toEqual({
      message: "Kernel went away",
      kind: "runtime",
    });
  });
});

describe("staticAdapter", () => {
  it("is always ready with no progress and no error", () => {
    const store = createStore();
    expect(store.get(staticAdapter.phase)).toBe("ready");
    expect(store.get(staticAdapter.progress)).toBeNull();
    expect(store.get(staticAdapter.error)).toBeNull();
  });

  it("advertises no capabilities (no kernel)", () => {
    const store = createStore();
    expect(store.get(staticAdapter.capabilities)).toEqual({
      canHealthCheck: false,
      canShutdown: false,
      canRestart: false,
      supportsLsp: false,
    });
  });
});

describe("islandsAdapter", () => {
  it("is connecting before islands report initialization", () => {
    const store = createStore();
    store.set(islandsInitializedAtom, false);
    expect(store.get(islandsAdapter.phase)).toBe("connecting");
  });

  it("is ready once islands initialize", () => {
    const store = createStore();
    store.set(islandsInitializedAtom, true);
    expect(store.get(islandsAdapter.phase)).toBe("ready");
  });

  it("surfaces the error string when islands fail", () => {
    const store = createStore();
    store.set(islandsInitializedAtom, "wheel download failed");
    expect(store.get(islandsAdapter.phase)).toBe("failed");
    expect(store.get(islandsAdapter.error)).toEqual({
      message: "wheel download failed",
      kind: "init",
    });
  });
});
