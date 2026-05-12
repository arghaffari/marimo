/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import { hasCellsAtom, notebookAtom } from "../cells/cells";
import { isOutputEmpty } from "../cells/outputs";
import { atLeastPhaseAtom } from "./phase";

/**
 * Capability atoms — declarative answers to "what can we show / do right now?".
 *
 * Components and gates should consult these atoms instead of re-deriving the
 * same combinations from primary signals.
 */

/**
 * True when the notebook has at least one cell hydrated. Whether the cell
 * came from a snapshot or from the kernel doesn't matter.
 */
export const canShowCellsAtom = hasCellsAtom;

/**
 * True when at least one cell has a non-empty cached output to display. The
 * stricter form of the legacy `hasAnyOutputAtom`, which conflated "any
 * output" with "all cells idle".
 */
export const canShowCachedOutputsAtom = atom<boolean>((get) => {
  const runtimeStates = Object.values(get(notebookAtom).cellRuntime);
  if (runtimeStates.length === 0) {
    return false;
  }
  return runtimeStates.some((runtime) => !isOutputEmpty(runtime.output));
});

/**
 * True when the kernel has ack'd instantiation — cell runs / package installs
 * etc. will reach a real Python process.
 */
export const canRunCellsAtom = atLeastPhaseAtom("kernel-ready");

/**
 * True when the runtime is fully interactive (first cell-op completed). UI
 * elements bound to widgets should not accept input before this point.
 */
export const canMutateUIElementsAtom = atLeastPhaseAtom("interactive");
