/* Copyright 2026 Marimo. All rights reserved. */

import { act, render, screen } from "@testing-library/react";
import { atom, createStore, type PrimitiveAtom, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lifecyclePhaseAtom } from "@/core/lifecycle/phase";
import type { LifecyclePhase } from "@/core/lifecycle/phase";

// Replace `lifecyclePhaseAtom` with a writable primitive so the test can
// drive the phase directly. `atLeastPhaseAtom` becomes a thin derived atom
// over the same primitive.
vi.mock("@/core/lifecycle/phase", async () => {
  const actual = await vi.importActual<typeof import("@/core/lifecycle/phase")>(
    "@/core/lifecycle/phase",
  );
  const { atom: jotaiAtom } = await import("jotai");
  const phaseAtom = jotaiAtom<LifecyclePhase>("boot");
  return {
    ...actual,
    lifecyclePhaseAtom: phaseAtom,
    atLeastPhaseAtom: (phase: LifecyclePhase) =>
      jotaiAtom(
        (get) =>
          actual.PHASE_ORDER[get(phaseAtom)] >= actual.PHASE_ORDER[phase],
      ),
  };
});

// Replace RuntimeProgress so we don't pull in the adapter machinery.
vi.mock("../RuntimeProgress", () => ({
  RuntimeProgress: () => <span>spinner</span>,
}));

import { ProgressiveBoundary } from "../ProgressiveBoundary";

// At runtime the mocked atom is writable; the production type says
// `Atom<LifecyclePhase>` (read-only). Cast for the test.
const writablePhaseAtom =
  lifecyclePhaseAtom as unknown as PrimitiveAtom<LifecyclePhase>;

describe("ProgressiveBoundary", () => {
  let store: ReturnType<typeof createStore>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    store = createStore();
    store.set(writablePhaseAtom, "boot");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children when no gate is configured", () => {
    render(
      <ProgressiveBoundary>
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("blocks children until minPhase is satisfied", () => {
    render(
      <ProgressiveBoundary minPhase="kernel-ready" fallback={<span>wait</span>}>
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(screen.getByText("wait")).toBeInTheDocument();

    act(() => {
      store.set(writablePhaseAtom, "kernel-ready");
    });
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("respects capability atom (requires)", () => {
    const capability = atom(false);

    render(
      <ProgressiveBoundary requires={capability} fallback={<span>wait</span>}>
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.getByText("wait")).toBeInTheDocument();

    act(() => {
      store.set(capability, true);
    });
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("reopens the gate (renders fallback again) when a capability flips back to false", () => {
    const capability = atom(true);

    render(
      <ProgressiveBoundary requires={capability} fallback={<span>wait</span>}>
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.getByText("content")).toBeInTheDocument();

    act(() => {
      store.set(capability, false);
    });
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(screen.getByText("wait")).toBeInTheDocument();
  });

  it("requires BOTH minPhase and requires to be satisfied", () => {
    const capability = atom(false);

    render(
      <ProgressiveBoundary
        minPhase="kernel-ready"
        requires={capability}
        fallback={<span>wait</span>}
      >
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.getByText("wait")).toBeInTheDocument();

    act(() => {
      store.set(writablePhaseAtom, "kernel-ready");
    });
    expect(screen.getByText("wait")).toBeInTheDocument();

    act(() => {
      store.set(capability, true);
    });
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("delays the fallback when delay > 0", () => {
    render(
      <ProgressiveBoundary
        minPhase="kernel-ready"
        delay={2000}
        fallback={<span>wait</span>}
      >
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
    expect(screen.queryByText("wait")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("wait")).toBeInTheDocument();
  });

  it("skips the fallback entirely if the gate opens before the delay", () => {
    render(
      <ProgressiveBoundary
        minPhase="kernel-ready"
        delay={5000}
        fallback={<span>wait</span>}
      >
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );

    expect(screen.queryByText("wait")).not.toBeInTheDocument();

    act(() => {
      store.set(writablePhaseAtom, "kernel-ready");
    });
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("falls back to <RuntimeProgress /> when no fallback prop is passed", () => {
    render(
      <ProgressiveBoundary minPhase="kernel-ready">
        <span>content</span>
      </ProgressiveBoundary>,
      { wrapper },
    );
    expect(screen.getByText("spinner")).toBeInTheDocument();
  });
});
