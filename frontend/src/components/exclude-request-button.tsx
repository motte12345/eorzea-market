"use client";

import { useEffect, useState } from "react";
import { requestExclusion } from "@/lib/api";
import {
  hasRequestedExclusion,
  markExclusionRequested,
} from "@/lib/exclusion-request-store";
import { useTranslation } from "@/lib/i18n";

interface Props {
  itemId: number;
}

export function ExcludeRequestButton({ itemId }: Props) {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRequested(hasRequestedExclusion(itemId));
  }, [itemId]);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (requested || busy) return;
    if (!window.confirm(t("excludeRequestConfirm"))) return;

    setBusy(true);
    try {
      await requestExclusion(itemId);
      markExclusionRequested(itemId);
      setRequested(true);
    } catch {
      window.alert(t("excludeRequestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={requested || busy}
      title={requested ? t("excludeRequestDone") : t("excludeRequestTitle")}
      className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] disabled:cursor-default disabled:opacity-40 disabled:hover:text-[var(--muted-foreground)]"
      aria-label={t("excludeRequestButton")}
    >
      {requested ? "✓" : "🚫"}
    </button>
  );
}
