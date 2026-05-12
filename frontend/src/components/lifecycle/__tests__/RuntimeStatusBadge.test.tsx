/* Copyright 2026 Marimo. All rights reserved. */

import { act, render, screen } from "@testing-library/react";
import { atom, createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type RuntimeAdapter,
  runtimeAdapterAtom,
  type RuntimeError,
  type RuntimePhase,
  type RuntimeProgress,
} from "@/core/runtime/adapter";
import { RuntimeStatusBadge } from "../RuntimeStatusBadge";

function makeAdapter(initial: {
  phase: RuntimePhase;
  progress?: RuntimeProgress | null;
  error?: RuntimeError | null;
}): RuntimeAdapter {
  return {
    kind: "remote",
    label: "Kernel",
    phase: atom<RuntimePhase>(initial.phase),
    progress: atom<RuntimeProgress | null>(initial.progress ?? null),
    error: atom<RuntimeError | null>(initial.error ?? null),
    capabilities: atom({
      canHealthCheck: true,
      canShutdown: true,
      canRestart: true,
      supportsLsp: true,
    }),
  };
}

let store: ReturnType<typeof createStore>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <TooltipProvider>{children}</TooltipProvider>
  </Provider>
);

beforeEach(() => {
  vi.useFakeTimers();
  store = createStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RuntimeStatusBadge — footer surface", () => {
  it("hides itself when phase is ready (showWhen=active, default)", () => {
    const adapter = makeAdapter({ phase: "ready" });
    store.set(runtimeAdapterAtom, adapter);

    const { container } = render(<RuntimeStatusBadge surface="footer" />, {
      wrapper,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a healthy pill with showWhen=always", () => {
    const adapter = makeAdapter({ phase: "ready" });
    store.set(runtimeAdapterAtom, adapter);

    render(<RuntimeStatusBadge surface="footer" showWhen="always" />, {
      wrapper,
    });
    expect(screen.getByTestId("runtime-status-footer")).toBeInTheDocument();
    expect(screen.getByText("Kernel")).toBeInTheDocument();
  });

  it("shows a spinner while connecting and the progress label tooltip", () => {
    const adapter = makeAdapter({
      phase: "connecting",
      progress: { label: "Loading Pyodide…" },
    });
    store.set(runtimeAdapterAtom, adapter);

    render(<RuntimeStatusBadge surface="footer" />, { wrapper });
    expect(screen.getByTestId("runtime-status-footer")).toBeInTheDocument();
  });

  it("shows the failure icon on phase=failed", () => {
    const adapter = makeAdapter({
      phase: "failed",
      error: { message: "Boom", kind: "init" },
    });
    store.set(runtimeAdapterAtom, adapter);

    render(<RuntimeStatusBadge surface="footer" />, { wrapper });
    expect(screen.getByTestId("runtime-status-footer")).toBeInTheDocument();
  });
});

describe("RuntimeStatusBadge — header surface", () => {
  it("renders nothing when ready", () => {
    const adapter = makeAdapter({ phase: "ready" });
    store.set(runtimeAdapterAtom, adapter);
    const { container } = render(
      <RuntimeStatusBadge surface="header" showWhen="always" />,
      { wrapper },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the ellipsis indicator while connecting", () => {
    const adapter = makeAdapter({ phase: "connecting" });
    store.set(runtimeAdapterAtom, adapter);
    render(<RuntimeStatusBadge surface="header" />, { wrapper });
    expect(screen.getByTestId("runtime-status-header")).toBeInTheDocument();
  });
});

describe("RuntimeStatusBadge — alert surface", () => {
  it("delays rendering by delayMs (defaults to 1000)", () => {
    const adapter = makeAdapter({ phase: "connecting" });
    store.set(runtimeAdapterAtom, adapter);

    render(<RuntimeStatusBadge surface="alert" />, { wrapper });
    // Before the delay elapses, no banner.
    expect(
      screen.queryByTestId("runtime-status-alert"),
    ).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("runtime-status-alert")).toBeInTheDocument();
  });

  it("respects an explicit delayMs override", () => {
    const adapter = makeAdapter({ phase: "connecting" });
    store.set(runtimeAdapterAtom, adapter);

    render(<RuntimeStatusBadge surface="alert" delayMs={0} />, { wrapper });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByTestId("runtime-status-alert")).toBeInTheDocument();
  });

  it("renders nothing when ready", () => {
    const adapter = makeAdapter({ phase: "ready" });
    store.set(runtimeAdapterAtom, adapter);
    const { container } = render(
      <RuntimeStatusBadge surface="alert" showWhen="always" />,
      { wrapper },
    );
    expect(container).toBeEmptyDOMElement();
  });
});
