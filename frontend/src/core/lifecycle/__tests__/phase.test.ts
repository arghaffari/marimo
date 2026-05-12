/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import { WebSocketState } from "../../websocket/types";
import {
  comparePhases,
  computeLifecyclePhase,
  LIFECYCLE_PHASES,
} from "../phase";

const base = {
  runtimeKind: "remote" as const,
  hasCells: false,
  connectionState: WebSocketState.NOT_STARTED,
  wasmStatus: "loading" as const,
  kernelInstantiated: false,
  islandsInitialized: false,
};

describe("computeLifecyclePhase — remote runtime", () => {
  it("returns boot before cells hydrate", () => {
    expect(computeLifecyclePhase(base)).toBe("boot");
  });

  it("returns hydrated once cells are present but WS not yet started", () => {
    expect(computeLifecyclePhase({ ...base, hasCells: true })).toBe("hydrated");
  });

  it("returns runtime-connecting while WS is dialing", () => {
    expect(
      computeLifecyclePhase({
        ...base,
        connectionState: WebSocketState.CONNECTING,
      }),
    ).toBe("runtime-connecting");
  });

  it("returns runtime-ready once WS open but kernel not yet instantiated", () => {
    expect(
      computeLifecyclePhase({
        ...base,
        hasCells: true,
        connectionState: WebSocketState.OPEN,
        kernelInstantiated: false,
      }),
    ).toBe("runtime-ready");
  });

  it("returns kernel-ready once kernel instantiation acked", () => {
    expect(
      computeLifecyclePhase({
        ...base,
        hasCells: true,
        connectionState: WebSocketState.OPEN,
        kernelInstantiated: true,
      }),
    ).toBe("kernel-ready");
  });

  it("rolls back to hydrated on disconnect (keeps cells visible)", () => {
    expect(
      computeLifecyclePhase({
        ...base,
        hasCells: true,
        connectionState: WebSocketState.CLOSED,
      }),
    ).toBe("hydrated");
  });

  it("rolls back to boot on disconnect with no cells", () => {
    expect(
      computeLifecyclePhase({
        ...base,
        hasCells: false,
        connectionState: WebSocketState.CLOSED,
      }),
    ).toBe("boot");
  });
});

describe("computeLifecyclePhase — WASM runtime", () => {
  const wasmBase = { ...base, runtimeKind: "wasm" as const };

  it("treats loading-with-no-cells as boot", () => {
    expect(computeLifecyclePhase(wasmBase)).toBe("boot");
  });

  it("paints hydrated snapshot before Pyodide is ready", () => {
    expect(
      computeLifecyclePhase({
        ...wasmBase,
        hasCells: true,
        wasmStatus: "loading",
      }),
    ).toBe("hydrated");
  });

  it("reaches interactive once Pyodide is ready and cells hydrated", () => {
    expect(
      computeLifecyclePhase({
        ...wasmBase,
        hasCells: true,
        wasmStatus: "ready",
      }),
    ).toBe("interactive");
  });

  it("returns runtime-ready when Pyodide is up but no cells yet", () => {
    expect(
      computeLifecyclePhase({
        ...wasmBase,
        hasCells: false,
        wasmStatus: "ready",
      }),
    ).toBe("runtime-ready");
  });

  it("falls back to hydrated on init error if cells are visible", () => {
    expect(
      computeLifecyclePhase({
        ...wasmBase,
        hasCells: true,
        wasmStatus: "error",
      }),
    ).toBe("hydrated");
  });

  it("stays at boot on init error if no cells yet", () => {
    expect(
      computeLifecyclePhase({
        ...wasmBase,
        hasCells: false,
        wasmStatus: "error",
      }),
    ).toBe("boot");
  });
});

describe("computeLifecyclePhase — static notebooks", () => {
  const staticBase = { ...base, runtimeKind: "static" as const };

  it("treats no-cells as boot even in static mode", () => {
    expect(computeLifecyclePhase(staticBase)).toBe("boot");
  });

  it("treats hydrated static notebooks as interactive", () => {
    expect(computeLifecyclePhase({ ...staticBase, hasCells: true })).toBe(
      "interactive",
    );
  });
});

describe("computeLifecyclePhase — islands", () => {
  const islandsBase = { ...base, runtimeKind: "islands" as const };

  it("boots while islands have no cells", () => {
    expect(computeLifecyclePhase(islandsBase)).toBe("boot");
  });

  it("connecting while cells hydrated but bootstrap pending", () => {
    expect(computeLifecyclePhase({ ...islandsBase, hasCells: true })).toBe(
      "runtime-connecting",
    );
  });

  it("interactive once islands report initialization", () => {
    expect(
      computeLifecyclePhase({
        ...islandsBase,
        hasCells: true,
        islandsInitialized: true,
      }),
    ).toBe("interactive");
  });
});

describe("comparePhases", () => {
  it("orders all phases monotonically", () => {
    for (let i = 0; i < LIFECYCLE_PHASES.length - 1; i++) {
      expect(
        comparePhases(LIFECYCLE_PHASES[i], LIFECYCLE_PHASES[i + 1]),
      ).toBeLessThan(0);
      expect(
        comparePhases(LIFECYCLE_PHASES[i + 1], LIFECYCLE_PHASES[i]),
      ).toBeGreaterThan(0);
    }
    expect(comparePhases("boot", "boot")).toBe(0);
    expect(comparePhases("interactive", "interactive")).toBe(0);
  });
});
