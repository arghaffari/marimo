/* Copyright 2026 Marimo. All rights reserved. */

import { type Atom, atom, useAtomValue } from "jotai";
import type React from "react";
import { type PropsWithChildren, useEffect, useMemo, useState } from "react";
import { atLeastPhaseAtom, type LifecyclePhase } from "@/core/lifecycle/phase";
import { RuntimeProgress } from "./RuntimeProgress";

interface Props {
  /**
   * Minimum lifecycle phase required to render children. Optional — if both
   * `minPhase` and `requires` are omitted the boundary always renders.
   */
  minPhase?: LifecyclePhase;
  /**
   * Capability atom to check. Children render once this atom resolves true.
   * Composes additively with `minPhase` (both must be satisfied).
   */
  requires?: Atom<boolean>;
  /**
   * Fallback rendered while the gate is closed. Defaults to a
   * `<RuntimeProgress />` that reads the adapter's progress label.
   */
  fallback?: React.ReactNode;
  /**
   * Optional debounce: only render the fallback if the gate is still closed
   * after this many milliseconds. Matches the `DelayMount` pattern used in
   * `run-app.tsx` and `connecting-alert.tsx`.
   */
  delay?: number;
}

const ALWAYS_TRUE_ATOM = atom(true);

/**
 * Gates rendering on the runtime lifecycle. Use this in place of the ad-hoc
 * `hasCells && …` / `isConnecting && DelayMount` branches scattered through
 * the app.
 *
 * ```tsx
 * <ProgressiveBoundary minPhase="kernel-ready" delay={2000}>
 *   <Editor />
 * </ProgressiveBoundary>
 * ```
 */
export const ProgressiveBoundary: React.FC<PropsWithChildren<Props>> = ({
  minPhase,
  requires,
  fallback,
  delay = 0,
  children,
}) => {
  const phaseAtom = useMemo(
    () => (minPhase ? atLeastPhaseAtom(minPhase) : ALWAYS_TRUE_ATOM),
    [minPhase],
  );
  const phaseReady = useAtomValue(phaseAtom);
  const capabilityReady = useAtomValue(requires ?? ALWAYS_TRUE_ATOM);

  const ready = phaseReady && capabilityReady;

  // Track whether the delay has elapsed. Only matters while !ready.
  const [delayElapsed, setDelayElapsed] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) {
      setDelayElapsed(true);
      return;
    }
    setDelayElapsed(false);
    const t = setTimeout(() => setDelayElapsed(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (ready) {
    return children;
  }

  if (!delayElapsed) {
    return null;
  }

  return fallback ?? <RuntimeProgress />;
};
