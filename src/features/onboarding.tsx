"use client";

import { useRef, useState } from "react";
import { Button, Card, Segmented } from "@/components/ui";
import { addBaby } from "@/db/repo";
import { setSetting } from "@/db/settings";
import type { SettingsValues } from "@/db/types";
import { BabyForm } from "@/features/babies/baby-form";
import { useT } from "@/i18n";
import { requestPersistence } from "@/lib/pwa";

/** First run: disclaimer, language/units, first baby, or restore from a backup file. */
export function Onboarding({ settings }: { settings: SettingsValues }) {
  const t = useT();
  const [accepted, setAccepted] = useState(settings.disclaimerAcceptedAt !== null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function accept() {
    await setSetting("disclaimerAcceptedAt", Date.now());
    void requestPersistence();
  }

  async function restore(file: File) {
    setRestoreError(null);
    try {
      const { importBackupText } = await import("@/features/backup/import");
      await accept();
      await importBackupText(await file.text(), "merge", true);
    } catch {
      setRestoreError(t("backup.badFile"));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("onboarding.welcome")}</h1>
        <p className="mt-1 text-muted">{t("onboarding.tagline")}</p>
      </header>

      <Card className="flex flex-col gap-3">
        <Segmented
          label={t("settings.language")}
          value={settings.locale}
          onChange={(v) => setSetting("locale", v)}
          options={[
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <Segmented
            label={t("settings.volumeUnit")}
            value={settings.volumeUnit}
            onChange={(v) => setSetting("volumeUnit", v)}
            options={[
              { value: "oz", label: "oz" },
              { value: "ml", label: "ml" },
            ]}
          />
          <Segmented
            label={t("settings.measureUnit")}
            value={settings.measureUnit}
            onChange={(v) => setSetting("measureUnit", v)}
            options={[
              { value: "imperial", label: "lb / in" },
              { value: "metric", label: "kg / cm" },
            ]}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("onboarding.disclaimerTitle")}</h2>
        <p className="text-sm text-muted">{t("onboarding.disclaimer")}</p>
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="size-6 accent-[var(--primary)]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span className="text-sm font-medium">{t("onboarding.accept")}</span>
        </label>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{t("onboarding.firstBaby")}</h2>
        <BabyForm
          submitLabel={t("onboarding.start")}
          disabled={!accepted}
          onSubmit={async (input) => {
            await addBaby(input);
            await accept();
          }}
        />
      </Card>

      <div className="flex flex-col items-center gap-2 pb-6">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label={t("onboarding.restore")}
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
            e.target.value = "";
          }}
        />
        <Button variant="ghost" disabled={!accepted} onClick={() => fileRef.current?.click()}>
          {t("onboarding.restore")}
        </Button>
        {restoreError && (
          <p role="alert" className="text-sm font-medium text-danger">
            {restoreError}
          </p>
        )}
      </div>
    </main>
  );
}
