/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import { computeRenderPolicy } from "../render-policy";

describe("computeRenderPolicy", () => {
  it("shows code in edit mode", () => {
    const policy = computeRenderPolicy({
      mode: "edit",
      showAppCode: false, // ignored in edit mode
      hasCells: true,
      hasCachedOutputs: false,
    });
    expect(policy.showCode).toBe(true);
    expect(policy.blockInteractionUntilReady).toBe(false);
  });

  it("hides code in present mode regardless of config", () => {
    const policy = computeRenderPolicy({
      mode: "present",
      showAppCode: true,
      hasCells: true,
      hasCachedOutputs: true,
    });
    expect(policy.showCode).toBe(false);
    expect(policy.blockInteractionUntilReady).toBe(true);
  });

  it("respects showAppCode in read mode", () => {
    expect(
      computeRenderPolicy({
        mode: "read",
        showAppCode: true,
        hasCells: true,
        hasCachedOutputs: false,
      }).showCode,
    ).toBe(true);

    expect(
      computeRenderPolicy({
        mode: "read",
        showAppCode: false,
        hasCells: true,
        hasCachedOutputs: false,
      }).showCode,
    ).toBe(false);
  });

  it("paints cached outputs when cells + outputs are present", () => {
    expect(
      computeRenderPolicy({
        mode: "read",
        showAppCode: false,
        hasCells: true,
        hasCachedOutputs: true,
      }).showCachedOutputs,
    ).toBe(true);

    expect(
      computeRenderPolicy({
        mode: "read",
        showAppCode: false,
        hasCells: true,
        hasCachedOutputs: false,
      }).showCachedOutputs,
    ).toBe(false);

    expect(
      computeRenderPolicy({
        mode: "read",
        showAppCode: false,
        hasCells: false,
        hasCachedOutputs: true,
      }).showCachedOutputs,
    ).toBe(false);
  });

  it("returns sensible defaults for home/gallery", () => {
    const policy = computeRenderPolicy({
      mode: "home",
      showAppCode: false,
      hasCells: false,
      hasCachedOutputs: false,
    });
    expect(policy.showCode).toBe(true);
    expect(policy.blockInteractionUntilReady).toBe(false);
  });
});
