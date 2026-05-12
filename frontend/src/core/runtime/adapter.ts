/* Copyright 2026 Marimo. All rights reserved. */

import { type Atom, atom } from "jotai";
import { islandsInitializedAtom } from "../islands/state";
import { isIslands } from "../islands/utils";
import { connectionAtom } from "../network/connection";
import { isStaticNotebook } from "../static/static-state";
import {
  wasmInitErrorAtom,
  wasmInitializationAtom,
  wasmInitStatusAtom,
} from "../wasm/state";
import { isWasm } from "../wasm/utils";
import { WebSocketState } from "../websocket/types";

/**
 * Discriminator: which runtime is this notebook attached to?
 */
export type RuntimeKind = "wasm" | "remote" | "static" | "islands";

/**
 * Subset of the lifecycle that an adapter publishes about itself. Higher-level
 * `lifecyclePhaseAtom` derives `LifecyclePhase` from these + the cell state.
 */
export type RuntimePhase = "connecting" | "ready" | "failed";

export interface RuntimeProgress {
  /** User-facing label, e.g. "Loading Pyodide…" or "Connecting…". */
  label: string;
  /** Optional 0..1 progress for runtimes that expose it. */
  percent?: number;
}

export interface RuntimeError {
  message: string;
  /** `init` = failed to start. `runtime` = healthy but a request blew up. */
  kind: "init" | "runtime";
}

/**
 * UI affordances that vary by runtime. The `<RuntimeStatusBadge>` uses these
 * to decide which controls to render in tooltips / context menus.
 */
export interface RuntimeCapabilities {
  /** True if the runtime exposes a `/health` endpoint or equivalent. */
  canHealthCheck: boolean;
  /** True if the user can shutdown / restart the kernel. */
  canShutdown: boolean;
  canRestart: boolean;
  /** True if a Language Server backs this runtime. */
  supportsLsp: boolean;
}

/**
 * Adapter contract. All runtimes implement this so consumers don't branch on
 * `isWasm()` / `isStaticNotebook()` / `isIslands()` at the call site.
 */
export interface RuntimeAdapter {
  readonly kind: RuntimeKind;
  /** Short label suitable for status pills, e.g. "Kernel", "Pyodide". */
  readonly label: string;

  phase: Atom<RuntimePhase>;
  progress: Atom<RuntimeProgress | null>;
  error: Atom<RuntimeError | null>;
  capabilities: Atom<RuntimeCapabilities>;
}

// ---------------------------------------------------------------------------
// WASM adapter — wraps Pyodide bridge + wasmInit* atoms.
// ---------------------------------------------------------------------------

const wasmPhaseAtom = atom<RuntimePhase>((get) => {
  switch (get(wasmInitStatusAtom)) {
    case "ready":
      return "ready";
    case "error":
      return "failed";
    case "loading":
    default:
      return "connecting";
  }
});

const wasmProgressAtom = atom<RuntimeProgress | null>((get) => {
  if (get(wasmInitStatusAtom) === "ready") {
    return null;
  }
  return { label: get(wasmInitializationAtom) };
});

const wasmErrorAtom = atom<RuntimeError | null>((get) => {
  if (get(wasmInitStatusAtom) !== "error") {
    return null;
  }
  return {
    message: get(wasmInitErrorAtom) || "Pyodide failed to initialize",
    kind: "init",
  };
});

const wasmCapabilitiesAtom = atom<RuntimeCapabilities>({
  canHealthCheck: false,
  canShutdown: false,
  canRestart: false,
  supportsLsp: false,
});

export const wasmAdapter: RuntimeAdapter = {
  kind: "wasm",
  label: "Pyodide",
  phase: wasmPhaseAtom,
  progress: wasmProgressAtom,
  error: wasmErrorAtom,
  capabilities: wasmCapabilitiesAtom,
};

// ---------------------------------------------------------------------------
// Remote adapter — wraps connectionAtom (WS state).
// ---------------------------------------------------------------------------

const remotePhaseAtom = atom<RuntimePhase>((get) => {
  switch (get(connectionAtom).state) {
    case WebSocketState.OPEN:
      return "ready";
    case WebSocketState.CONNECTING:
    case WebSocketState.NOT_STARTED:
      return "connecting";
    case WebSocketState.CLOSING:
    case WebSocketState.CLOSED:
    default:
      return "failed";
  }
});

const remoteProgressAtom = atom<RuntimeProgress | null>((get) => {
  const state = get(connectionAtom).state;
  if (state === WebSocketState.CONNECTING) {
    return { label: "Connecting…" };
  }
  if (state === WebSocketState.NOT_STARTED) {
    return { label: "Not connected" };
  }
  return null;
});

const remoteErrorAtom = atom<RuntimeError | null>((get) => {
  const conn = get(connectionAtom);
  if (conn.state !== WebSocketState.CLOSED) {
    return null;
  }
  return { message: conn.reason || "Disconnected", kind: "runtime" };
});

const remoteCapabilitiesAtom = atom<RuntimeCapabilities>({
  canHealthCheck: true,
  canShutdown: true,
  canRestart: true,
  supportsLsp: true,
});

export const remoteAdapter: RuntimeAdapter = {
  kind: "remote",
  label: "Kernel",
  phase: remotePhaseAtom,
  progress: remoteProgressAtom,
  error: remoteErrorAtom,
  capabilities: remoteCapabilitiesAtom,
};

// ---------------------------------------------------------------------------
// Static adapter — nothing to do, always ready.
// ---------------------------------------------------------------------------

const staticPhaseAtom = atom<RuntimePhase>("ready");
const staticProgressAtom = atom<RuntimeProgress | null>(null);
const staticErrorAtom = atom<RuntimeError | null>(null);
const staticCapabilitiesAtom = atom<RuntimeCapabilities>({
  canHealthCheck: false,
  canShutdown: false,
  canRestart: false,
  supportsLsp: false,
});

export const staticAdapter: RuntimeAdapter = {
  kind: "static",
  label: "Static",
  phase: staticPhaseAtom,
  progress: staticProgressAtom,
  error: staticErrorAtom,
  capabilities: staticCapabilitiesAtom,
};

// ---------------------------------------------------------------------------
// Islands adapter — wraps islandsInitializedAtom.
// ---------------------------------------------------------------------------

const islandsPhaseAtom = atom<RuntimePhase>((get) => {
  const status = get(islandsInitializedAtom);
  if (status === true) {
    return "ready";
  }
  if (typeof status === "string") {
    return "failed";
  }
  return "connecting";
});

const islandsProgressAtom = atom<RuntimeProgress | null>((get) => {
  const status = get(islandsInitializedAtom);
  if (status === true || typeof status === "string") {
    return null;
  }
  return { label: "Initializing islands…" };
});

const islandsErrorAtom = atom<RuntimeError | null>((get) => {
  const status = get(islandsInitializedAtom);
  if (typeof status !== "string") {
    return null;
  }
  return { message: status, kind: "init" };
});

const islandsCapabilitiesAtom = atom<RuntimeCapabilities>({
  canHealthCheck: false,
  canShutdown: false,
  canRestart: false,
  supportsLsp: false,
});

export const islandsAdapter: RuntimeAdapter = {
  kind: "islands",
  label: "Islands",
  phase: islandsPhaseAtom,
  progress: islandsProgressAtom,
  error: islandsErrorAtom,
  capabilities: islandsCapabilitiesAtom,
};

// ---------------------------------------------------------------------------
// Active adapter — pick once at module load based on environment.
// ---------------------------------------------------------------------------

function selectAdapter(): RuntimeAdapter {
  if (isStaticNotebook()) {
    return staticAdapter;
  }
  if (isIslands()) {
    return islandsAdapter;
  }
  if (isWasm()) {
    return wasmAdapter;
  }
  return remoteAdapter;
}

/**
 * The active adapter. Read-only — the choice of runtime is set by the
 * environment at page load and doesn't change after mount.
 */
export const runtimeAdapterAtom = atom<RuntimeAdapter>(selectAdapter());
