"use client";

import { Archive, Download, HardDriveDownload, Pencil, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, PageTitle, Segmented, SectionTitle, Field, useToast } from "@/components/ui";
import { useBabies } from "@/db/hooks";
import { addBaby, deleteBabyForever, setBabyArchived, updateBaby } from "@/db/repo";
import { db } from "@/db/schema";
import { setSetting } from "@/db/settings";
import type { Baby } from "@/db/types";
import { BabySheet } from "@/features/babies/baby-form";
import { useLocale, useT } from "@/i18n";
import { readStorageStatus, requestPersistence, type StorageStatus } from "@/lib/pwa";
import { formatDayTime } from "@/lib/time";

const bytes = (n?: number) => (n === undefined ? "-" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export default function SettingsPage() {
  const { settings, baby } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const allBabies = useBabies(true);
  const [babySheet, setBabySheet] = useState<{ open: boolean; editing?: Baby }>({ open: false });
  const [storage, setStorage] = useState<StorageStatus>({ persisted: null });
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void readStorageStatus().then(setStorage);
  }, []);

  async function exportJson() {
    const [{ backupJson, backupFilename, markBackedUp }, { saveFile }] = await Promise.all([
      import("@/features/backup/export"),
      import("@/features/backup/save-file"),
    ]);
    const result = await saveFile(backupFilename("json"), await backupJson(), "application/json");
    if (result !== "cancelled") {
      await markBackedUp();
      toast.show({ message: t("backup.done") });
    }
  }

  async function exportCsv(kind: "feedings" | "diapers" | "measurements") {
    const [{ buildCsv, backupFilename }, { saveFile }] = await Promise.all([
      import("@/features/backup/export"),
      import("@/features/backup/save-file"),
    ]);
    await saveFile(backupFilename("csv", `mybaby-${kind}`), await buildCsv(kind), "text/csv");
  }

  async function importFile(file: File) {
    setImportMsg(null);
    if (importMode === "replace" && !window.confirm(t("backup.confirmReplace"))) return;
    try {
      const { importBackupText, importCsvText } = await import("@/features/backup/import");
      const text = await file.text();
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const r = isCsv ? await importCsvText(text, baby.id) : await importBackupText(text, importMode, importMode === "replace");
      setImportMsg({ ok: true, text: t("backup.result", { added: r.added, updated: r.updated, skipped: r.skipped, invalid: r.invalid }) });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      const key = code === "file-too-large" ? "backup.tooLarge" : code === "unknown-csv" ? "backup.unknownCsv" : "backup.badFile";
      setImportMsg({ ok: false, text: t(key) });
    }
  }

  async function persist() {
    await requestPersistence();
    setStorage(await readStorageStatus());
  }

  async function eraseAll() {
    if (!window.confirm(t("settings.eraseConfirm"))) return;
    db.close();
    await db.delete();
    localStorage.clear();
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    // Full reload on purpose: the database was just deleted and in-memory state must reset.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/app";
  }

  return (
    <div>
      <PageTitle>{t("nav.settings")}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <SectionTitle>{t("settings.babies")}</SectionTitle>
            <ul className="flex flex-col gap-2">
              {allBabies?.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-surface2 p-2 pl-4">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {b.name}
                    {b.archivedAt && <span className="ml-2 text-xs text-muted">{t("settings.archived")}</span>}
                  </span>
                  <button type="button" aria-label={t("common.edit")} className="grid size-12 place-items-center rounded-full" onClick={() => setBabySheet({ open: true, editing: b })}>
                    <Pencil aria-hidden className="size-5" />
                  </button>
                  {(allBabies?.length ?? 0) > 1 && (
                    <button
                      type="button"
                      aria-label={b.archivedAt ? t("settings.unarchive") : t("settings.archive")}
                      className="grid size-12 place-items-center rounded-full"
                      onClick={() => setBabyArchived(b.id, !b.archivedAt)}
                    >
                      <Archive aria-hidden className="size-5" />
                    </button>
                  )}
                  {(allBabies?.length ?? 0) > 1 && (
                    <button
                      type="button"
                      aria-label={t("common.delete")}
                      className="grid size-12 place-items-center rounded-full text-danger"
                      onClick={() => window.confirm(t("settings.deleteBabyConfirm", { name: b.name })) && deleteBabyForever(b.id)}
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <Button onClick={() => setBabySheet({ open: true })}>
              <Plus aria-hidden className="size-5" />
              {t("baby.add")}
            </Button>
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>{t("settings.preferences")}</SectionTitle>
            <Segmented
              label={t("settings.language")}
              value={settings.locale}
              onChange={(v) => setSetting("locale", v)}
              options={[
                { value: "en", label: "English" },
                { value: "es", label: "Español" },
              ]}
            />
            <Segmented
              label={t("settings.theme")}
              value={settings.theme}
              onChange={(v) => setSetting("theme", v)}
              options={[
                { value: "system", label: t("settings.themeSystem") },
                { value: "light", label: t("settings.themeLight") },
                { value: "dark", label: t("settings.themeDark") },
                { value: "night", label: t("settings.themeNight") },
              ]}
            />
            <p className="-mt-2 text-xs text-muted">{t("settings.nightHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t("settings.volumeUnit")}</span>
                <Segmented
                  label={t("settings.volumeUnit")}
                  value={settings.volumeUnit}
                  onChange={(v) => setSetting("volumeUnit", v)}
                  options={[
                    { value: "oz", label: "oz" },
                    { value: "ml", label: "ml" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t("settings.measureUnit")}</span>
                <Segmented
                  label={t("settings.measureUnit")}
                  value={settings.measureUnit}
                  onChange={(v) => setSetting("measureUnit", v)}
                  options={[
                    { value: "imperial", label: "lb/in" },
                    { value: "metric", label: "kg/cm" },
                  ]}
                />
              </div>
            </div>
            <Field label={t("settings.dayStart")} hint={t("settings.dayStartHint")}>
              {(id) => (
                <select
                  id={id}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface2 px-3"
                  value={settings.dayStartHour}
                  onChange={(e) => setSetting("dayStartHour", Number(e.target.value))}
                >
                  {[0, 3, 4, 5, 6, 7, 8].map((h) => (
                    <option key={h} value={h}>
                      {new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date(2024, 0, 1, h))}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3" id="backup">
            <SectionTitle>{t("settings.backup")}</SectionTitle>
            <p className="text-sm text-muted">
              {settings.lastBackupAt ? t("settings.lastBackup", { at: formatDayTime(settings.lastBackupAt, locale) }) : t("settings.neverBackedUp")}
            </p>
            <Button variant="primary" onClick={exportJson}>
              <Download aria-hidden className="size-5" />
              {t("backup.exportJson")}
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => exportCsv("feedings")}>{t("backup.csvFeedings")}</Button>
              <Button onClick={() => exportCsv("diapers")}>{t("backup.csvDiapers")}</Button>
              <Button onClick={() => exportCsv("measurements")}>{t("backup.csvGrowth")}</Button>
            </div>

            <hr className="border-line" />
            <Segmented
              label={t("backup.importMode")}
              value={importMode}
              onChange={setImportMode}
              options={[
                { value: "merge", label: t("backup.merge") },
                { value: "replace", label: t("backup.replace") },
              ]}
            />
            <p className="text-xs text-muted">{importMode === "merge" ? t("backup.mergeHint") : t("backup.replaceHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="sr-only"
              aria-label={t("backup.import")}
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden className="size-5" />
              {t("backup.import")}
            </Button>
            {importMsg && (
              <p role="status" className={importMsg.ok ? "text-sm font-medium text-ok" : "text-sm font-medium text-danger"}>
                {importMsg.text}
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>{t("settings.storage")}</SectionTitle>
            <p className="flex items-center gap-2 text-sm">
              <HardDriveDownload aria-hidden className="size-5 text-muted" />
              {storage.persisted ? t("settings.persistOn") : storage.persisted === false ? t("settings.persistOff") : t("settings.persistUnknown")}
            </p>
            <p className="text-xs text-muted">{t("settings.storageUsed", { used: bytes(storage.usage) })}</p>
            {storage.persisted === false && <Button onClick={persist}>{t("settings.requestPersist")}</Button>}
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>{t("settings.about")}</SectionTitle>
            <p className="flex items-start gap-2 text-sm text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
              {t("onboarding.disclaimer")}
            </p>
            <Link href="/privacy" className="text-sm font-medium text-primary underline">
              {t("settings.privacy")}
            </Link>
            <Button variant="danger" onClick={eraseAll}>
              <Trash2 aria-hidden className="size-5" />
              {t("settings.erase")}
            </Button>
          </Card>
        </div>
      </div>

      <BabySheet
        open={babySheet.open}
        editing={babySheet.editing}
        onClose={() => setBabySheet({ open: false })}
        onSubmit={async (input) => {
          if (babySheet.editing) await updateBaby(babySheet.editing.id, input);
          else await addBaby(input);
        }}
      />
    </div>
  );
}
