/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import type React from "react";
import { LargeSpinner } from "@/components/icons/large-spinner";
import { runtimeAdapterAtom } from "@/core/runtime/adapter";

interface Props {
  /**
   * Default message when the adapter has no progress information of its own.
   */
  defaultMessage?: string;
}

/**
 * Full-page spinner that displays whatever the active runtime adapter is
 * doing right now. Replaces `WasmSpinner` and the various ad-hoc spinners
 * that lived in `run-app.tsx` / `connecting-alert.tsx`.
 */
export const RuntimeProgress: React.FC<Props> = ({
  defaultMessage = "Loading notebook…",
}) => {
  const adapter = useAtomValue(runtimeAdapterAtom);
  const progress = useAtomValue(adapter.progress);
  return <LargeSpinner title={progress?.label ?? defaultMessage} />;
};
