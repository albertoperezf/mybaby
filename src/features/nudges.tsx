"use client";

import { DownloadCloud, Share, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { useApp, useNow } from "@/components/app-context";
import { Button, Card, useToast } from "@/components/ui";
import { useEntryCount } from "@/db/hooks";
import { setSetting } from "@/db/settings";
import { useT } from "@/i18n";
import { DAY } from "@/lib/time";
import { useInstall } from "@/lib/pwa";

/** Weekly nudge to export a backup: the only protection against browser data eviction. */
export function BackupNudge() {
  const { settings } = useApp();
  const t = useT();
  const toast = useToast();
  const count = useEntryCount();
  const now = useNow(600_000);
  const [busy, setBusy] = useState(false);

  const stale = settings.lastBackupAt === null || now - settings.lastBackupAt > 7 * DAY;
  const snoozed = settings.backupNudgeSnoozedAt !== null && now - settings.backupNudgeSnoozedAt < 3 * DAY;
  if (!count || count < 10 || !stale || snoozed) return null;

  async function backUp() {
    setBusy(true);
    try {
      const [{ backupJson, backupFilename, markBackedUp }, { saveFile }] = await Promise.all([
        import("@/features/backup/export"),
        import("@/features/backup/save-file"),
      ]);
      const result = await saveFile(backupFilename("json"), await backupJson(), "application/json");
      if (result !== "cancelled") {
        await markBackedUp();
        toast.show({ message: t("backup.done") });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-warn">
      <div className="flex items-start gap-3">
        <DownloadCloud aria-hidden className="mt-0.5 size-6 shrink-0 text-warn" />
        <div>
          <p className="font-semibold">{t("nudge.backupTitle")}</p>
          <p className="text-sm text-muted">{t("nudge.backupBody")}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" disabled={busy} onClick={backUp}>
          {t("nudge.backupNow")}
        </Button>
        <Button variant="ghost" onClick={() => setSetting("backupNudgeSnoozedAt", Date.now())}>
          {t("nudge.later")}
        </Button>
      </div>
    </Card>
  );
}

/** Installing to the Home Screen also protects data from iOS' 7-day storage cleanup. */
export function InstallHint() {
  const { settings } = useApp();
  const t = useT();
  const { standalone, ios, canPrompt, install } = useInstall();
  const count = useEntryCount();

  if (standalone || settings.installHintDismissedAt !== null || !count) return null;
  if (!canPrompt && !ios) return null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Smartphone aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-semibold">{t("nudge.installTitle")}</p>
          <p className="text-sm text-muted">
            {ios ? (
              <>
                {t("nudge.installIos1")} <Share aria-label={t("nudge.shareIcon")} className="inline size-4 align-text-bottom" />{" "}
                {t("nudge.installIos2")}
              </>
            ) : (
              t("nudge.installBody")
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("common.dismiss")}
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface2"
          onClick={() => setSetting("installHintDismissedAt", Date.now())}
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {canPrompt && (
        <Button variant="primary" onClick={install}>
          {t("nudge.installNow")}
        </Button>
      )}
    </Card>
  );
}
