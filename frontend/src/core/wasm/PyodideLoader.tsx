/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import type React from "react";
import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
import { ProgressiveBoundary } from "@/components/lifecycle/ProgressiveBoundary";
import { RuntimeProgress } from "@/components/lifecycle/RuntimeProgress";
import { toast } from "@/components/ui/use-toast";
import { hasSomethingToRenderAtom } from "@/core/lifecycle/render-policy";
import { useAsyncData } from "@/hooks/useAsyncData";
import { prettyError } from "@/utils/errors";
import { Logger } from "@/utils/Logger";
import { PyodideBridge } from "./bridge";
import { isWasm } from "./utils";

/**
 * HOC to load Pyodide before rendering children, if necessary.
 *
 * Render gate logic: paint as soon as the notebook has something user-visible
 * to show (snapshot, hydrated cells, etc.). Pyodide can finish downloading
 * in the background — UI elements simply won't be interactive until then.
 */
export const PyodideLoader: React.FC<PropsWithChildren> = ({ children }) => {
  if (!isWasm()) {
    return children;
  }

  return <PyodideLoaderInner>{children}</PyodideLoaderInner>;
};

const PyodideLoaderInner: React.FC<PropsWithChildren> = ({ children }) => {
  // Drive PyodideBridge.initialized — the worker has its own init lifecycle.
  // We toast a runtime error if the snapshot has already rendered (so we
  // don't tear it down); otherwise we throw to surface the error UI.
  const { error } = useAsyncData(async () => {
    await PyodideBridge.INSTANCE.initialized.promise;
    return true;
  }, []);

  const hasSomethingToRender = useAtomValue(hasSomethingToRenderAtom);

  const didToastErrorRef = useRef(false);
  useEffect(() => {
    if (error && hasSomethingToRender && !didToastErrorRef.current) {
      didToastErrorRef.current = true;
      Logger.error("Pyodide failed to initialize", error);
      toast({
        title: "Failed to start the notebook runtime",
        description: prettyError(error),
        variant: "danger",
      });
    }
  }, [error, hasSomethingToRender]);

  if (error && !hasSomethingToRender) {
    throw error;
  }

  return (
    <ProgressiveBoundary
      requires={hasSomethingToRenderAtom}
      fallback={<RuntimeProgress />}
    >
      {children}
    </ProgressiveBoundary>
  );
};
