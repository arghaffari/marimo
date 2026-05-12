/* Copyright 2026 Marimo. All rights reserved. */

import { type Atom, atom } from "jotai";
import { hasCellsAtom } from "../cells/cells";
import { islandsInitializedAtom } from "../islands/state";
import { kernelStateAtom } from "../kernel/state";
import { connectionAtom } from "../network/connection";
import { runtimeAdapterAtom, type RuntimeKind } from "../runtime/adapter";
import { wasmInitStatusAtom } from "../wasm/state";
import { WebSocketState } from "../websocket/types";

/**
 * Totally-ordered lifecycle phase across all runtimes.
 *
 * - `boot`: mount.tsx is running, atoms are hydrating, no snapshot loaded yet.
 * - `hydrated`: notebookAtom is populated (cells exist) — paint can begin.
 * - `runtime-connecting`: WS dialing, Pyodide downloading.
 * - `runtime-ready`: transport open / Pyodide initialized — kernel hasn't ack'd yet.
 * - `kernel-ready`: kernel has acked instantiation; cells can run.
 * - `interactive`: full reactivity live (first cell-op flow completed).
 */
export const LIFECYCLE_PHASES = [
  "boot",
  "hydrated",
  "runtime-connecting",
  "runtime-ready",
  "kernel-ready",
  "interactive",
] as const;

export type LifecyclePhase = (typeof LIFECYCLE_PHASES)[number];

export const PHASE_ORDER: Record<LifecyclePhase, number> = Object.fromEntries(
  LIFECYCLE_PHASES.map((phase, index) => [phase, index]),
) as Record<LifecyclePhase, number>;

/**
 * Pure projection: compute the lifecycle phase from primary signals.
 * Exported for unit testing; production reads should go through
 * `lifecyclePhaseAtom`.
 */
export function computeLifecyclePhase(input: {
  runtimeKind: RuntimeKind;
  hasCells: boolean;
  connectionState: WebSocketState;
  wasmStatus: "loading" | "ready" | "error";
  kernelInstantiated: boolean;
  islandsInitialized: boolean;
}): LifecyclePhase {
  switch (input.runtimeKind) {
    case "static":
      // Static notebooks: nothing to boot. Once cells are hydrated we are
      // effectively interactive — there's no kernel handshake to wait for.
      return input.hasCells ? "interactive" : "boot";

    case "islands":
      if (!input.hasCells) {
        return "boot";
      }
      return input.islandsInitialized ? "interactive" : "runtime-connecting";

    case "wasm":
      if (input.wasmStatus === "ready") {
        // Pyodide is ready and (if cells exist) we've already replayed the
        // session — there's no separate kernel-ready signal for WASM.
        return input.hasCells ? "interactive" : "runtime-ready";
      }
      // wasmStatus === "loading" | "error" — keep showing what we have.
      return input.hasCells ? "hydrated" : "boot";

    case "remote":
      switch (input.connectionState) {
        case WebSocketState.NOT_STARTED:
          return input.hasCells ? "hydrated" : "boot";
        case WebSocketState.CONNECTING:
          return "runtime-connecting";
        case WebSocketState.OPEN:
          return input.kernelInstantiated ? "kernel-ready" : "runtime-ready";
        case WebSocketState.CLOSING:
        case WebSocketState.CLOSED:
          // Disconnected — phase rolls back to what we can still show. We don't
          // model "errored" as its own phase; consumers read the connection /
          // adapter atoms for error state.
          return input.hasCells ? "hydrated" : "boot";
      }
  }
}

/**
 * Derived atom exposing the current lifecycle phase. Composes primary signals
 * — no new sources of truth.
 */
export const lifecyclePhaseAtom = atom<LifecyclePhase>((get) => {
  return computeLifecyclePhase({
    runtimeKind: get(runtimeAdapterAtom).kind,
    hasCells: get(hasCellsAtom),
    connectionState: get(connectionAtom).state,
    wasmStatus: get(wasmInitStatusAtom),
    kernelInstantiated: get(kernelStateAtom).isInstantiated,
    islandsInitialized: get(islandsInitializedAtom) === true,
  });
});

export function comparePhases(a: LifecyclePhase, b: LifecyclePhase): number {
  return PHASE_ORDER[a] - PHASE_ORDER[b];
}

/**
 * Build a derived atom that resolves to `true` once the current lifecycle
 * phase is at least `phase`. Useful for gating UI by phase.
 */
export function atLeastPhaseAtom(phase: LifecyclePhase): Atom<boolean> {
  return atom((get) => comparePhases(get(lifecyclePhaseAtom), phase) >= 0);
}
