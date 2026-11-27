"use client";

import { Eye, EyeOff, Lock, Share2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, Segmented, Sheet, Switch, inputClass, useToast } from "@/components/ui";
import type { Baby, ID } from "@/db/types";
import { useT } from "@/i18n";
import { DAY } from "@/lib/time";
import { decryptBackupText, encryptBackupText } from "./crypto";
import { backupFilename, backupJson, markBackedUp } from "./export";
import { saveFile } from "./save-file";

function PassphraseInput({
  id,
  value,
  onChange,
  show,
  onToggleShow,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
}) {
  const t = useT();
  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        className={`${inputClass} pr-12`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        aria-label={show ? t("backup.hidePassphrase") : t("backup.showPassphrase")}
        onClick={onToggleShow}
        className="absolute right-1 grid size-10 place-items-center rounded-xl text-muted hover:bg-surface"
      >
        {show ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
    </div>
  );
}

interface ExportSheetProps {
  open: boolean;
  mode: "encrypt" | "share";
  babies: Baby[];
  onClose: () => void;
}

function ExportBackupForm({ mode, babies, onClose }: Omit<ExportSheetProps, "open">) {
  const t = useT();
  const toast = useToast();
  const isShare = mode === "share";

  const [scope, setScope] = useState<ID | "all">("all");
  const [range, setRange] = useState<"all" | "7" | "30">("all");
  const [protect, setProtect] = useState(!isShare);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPassphrase = !isShare || protect;

  async function submit() {
    setError(null);
    if (needsPassphrase) {
      if (pass.length < 6) {
        setError(t("backup.passShort"));
        return;
      }
      if (pass !== confirm) {
        setError(t("backup.passMismatch"));
        return;
      }
    }

    setBusy(true);
    try {
      const since = range === "7" ? Date.now() - 7 * DAY : range === "30" ? Date.now() - 30 * DAY : undefined;
      const plaintext = await backupJson({
        babyId: isShare && scope !== "all" ? scope : undefined,
        includeSettings: !isShare,
        since: isShare ? since : undefined,
      });
      const content = needsPassphrase ? await encryptBackupText(plaintext, pass) : plaintext;
      const stem = isShare ? "mybabylog-share" : "mybabylog-backup";
      const ext = needsPassphrase ? "enc.json" : "json";
      const result = await saveFile(backupFilename(ext, stem), content, "application/json");
      if (result !== "cancelled") {
        if (!isShare) await markBackedUp();
        toast.show({ message: isShare ? t("backup.sharedDone") : t("backup.done") });
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm text-muted">{isShare ? t("backup.shareBody") : t("backup.encryptBody")}</p>

      {isShare && babies.length > 1 && (
        <Field label={t("backup.shareScope")}>
          {(id) => (
            <select id={id} className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">{t("backup.allBabies")}</option>
              {babies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {isShare && (
        <Segmented
          label={t("backup.shareRange")}
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: t("backup.range7") },
            { value: "30", label: t("backup.range30") },
            { value: "all", label: t("backup.rangeAll") },
          ]}
        />
      )}

      {isShare && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface2 px-4 py-3">
          <span className="text-sm font-semibold">{t("backup.protectToggle")}</span>
          <Switch checked={protect} onChange={setProtect} label={t("backup.protectToggle")} />
        </div>
      )}

      {needsPassphrase && (
        <>
          <Field label={t("backup.passphrase")}>
            {(id) => (
              <PassphraseInput
                id={id}
                value={pass}
                onChange={setPass}
                show={showPass}
                onToggleShow={() => setShowPass((v) => !v)}
              />
            )}
          </Field>
          <Field label={t("backup.confirmPassphrase")}>
            {(id) => (
              <PassphraseInput
                id={id}
                value={confirm}
                onChange={setConfirm}
                show={showPass}
                onToggleShow={() => setShowPass((v) => !v)}
              />
            )}
          </Field>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <Button variant="primary" size="lg" disabled={busy} onClick={submit}>
        {isShare ? <Share2 aria-hidden className="size-5" /> : <Lock aria-hidden className="size-5" />}
        {busy ? t("backup.encrypting") : isShare ? t("backup.shareCaregiver") : t("backup.exportEncrypted")}
      </Button>
    </>
  );
}

export function ExportBackupSheet({ open, mode, babies, onClose }: ExportSheetProps) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={mode === "share" ? t("backup.shareTitle") : t("backup.encryptTitle")}>
      <ExportBackupForm mode={mode} babies={babies} onClose={onClose} />
    </Sheet>
  );
}

// ---- Decrypt prompt sheet --------------------------------------------------

interface DecryptSheetProps {
  open: boolean;
  envelopeText: string | null;
  onClose: () => void;
  onDecrypted: (plaintext: string) => Promise<void>;
}

function DecryptBackupForm({
  envelopeText,
  onClose,
  onDecrypted,
}: {
  envelopeText: string;
  onClose: () => void;
  onDecrypted: (plaintext: string) => Promise<void>;
}) {
  const t = useT();
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    setError(null);
    setBusy(true);
    try {
      const plaintext = await decryptBackupText(envelopeText, pass);
      await onDecrypted(plaintext);
      onClose();
    } catch {
      setError(t("backup.wrongPassphrase"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm text-muted">{t("backup.decryptBody")}</p>
      <Field label={t("backup.passphrase")}>
        {(id) => (
          <PassphraseInput
            id={id}
            value={pass}
            onChange={setPass}
            show={showPass}
            onToggleShow={() => setShowPass((v) => !v)}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <Button variant="primary" size="lg" disabled={busy || !pass} onClick={unlock}>
        <Lock aria-hidden className="size-5" />
        {busy ? t("backup.decrypting") : t("backup.unlockImport")}
      </Button>
    </>
  );
}

export function DecryptBackupSheet({ open, envelopeText, onClose, onDecrypted }: DecryptSheetProps) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("backup.decryptTitle")}>
      {envelopeText && <DecryptBackupForm envelopeText={envelopeText} onClose={onClose} onDecrypted={onDecrypted} />}
    </Sheet>
  );
}
