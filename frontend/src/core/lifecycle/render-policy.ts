/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import { KnownQueryParams } from "../constants";
import { showCodeInRunModeAtom } from "../meta/state";
import { type AppMode, initialModeAtom } from "../mode";
import { canShowCachedOutputsAtom, canShowCellsAtom } from "./capabilities";

/**
 * Mode-aware render policy. Centralizes the per-mode visibility decisions
 * scattered through gates and indicators today (e.g.
 * `getInitialAppMode() === "read" && isCodeHidden()`).
 */
export interface RenderPolicy {
  /**
   * True when code editors / source blocks would appear on screen. False in
   * `present` mode, and in `read` mode when the user has opted to hide code.
   */
  showCode: boolean;
  /**
   * True when cached outputs from a snapshot / prior run should paint while
   * the runtime is still booting.
   */
  showCachedOutputs: boolean;
  /**
   * True when widget mutations should be blocked until the kernel can ack
   * them. Driven by the lifecycle phase, not by mode.
   */
  blockInteractionUntilReady: boolean;
}

function readCodeVisibility(
  mode: AppMode | undefined,
  showAppCode: boolean,
): boolean {
  if (mode === "edit" || mode === "home" || mode === "gallery") {
    return true;
  }
  if (mode === "present") {
    return false;
  }
  // mode === "read" or undefined: defer to view config + query param.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get(KnownQueryParams.showCode) === "false") {
      return false;
    }
    if (params.get(KnownQueryParams.showCode) === "true") {
      return true;
    }
  }
  return showAppCode;
}

/**
 * Pure projection — exposed for unit tests.
 */
export function computeRenderPolicy(input: {
  mode: AppMode | undefined;
  showAppCode: boolean;
  hasCells: boolean;
  hasCachedOutputs: boolean;
}): RenderPolicy {
  const showCode = readCodeVisibility(input.mode, input.showAppCode);
  const isReadOnly = input.mode === "read" || input.mode === "present";

  return {
    showCode,
    // We can paint cached outputs whenever we have them — the mode only
    // dictates the wrapper UI around them.
    showCachedOutputs: input.hasCells && input.hasCachedOutputs,
    blockInteractionUntilReady: isReadOnly,
  };
}

export const renderPolicyAtom = atom<RenderPolicy>((get) => {
  return computeRenderPolicy({
    mode: get(initialModeAtom),
    showAppCode: get(showCodeInRunModeAtom),
    hasCells: get(canShowCellsAtom),
    hasCachedOutputs: get(canShowCachedOutputsAtom),
  });
});

/**
 * Returns `true` when the current view has *something* user-visible to paint
 * without waiting on the runtime. Generalization of the `shouldShowSpinner`
 * pure function previously inlined in `PyodideLoader`.
 *
 * - In edit mode, this is `hasCells` — the editor renders the cell skeleton
 *   even when output is empty.
 * - In read/present mode with code visible, the cell source is enough.
 * - In headless read mode (code hidden), we need cached outputs to display.
 */
export const hasSomethingToRenderAtom = atom<boolean>((get) => {
  const policy = get(renderPolicyAtom);
  const hasCells = get(canShowCellsAtom);
  if (!hasCells) {
    return false;
  }
  if (policy.showCode) {
    return true;
  }
  return policy.showCachedOutputs;
});
