"use client";

import { CloudOff, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, Switch } from "@/components/ui";
import { useT, type MessageKey } from "@/i18n";
import { isIos, isStandalone } from "@/lib/pwa";
import { disablePush, enablePush, fetchPushConfig, pushSupported, sendTestPush, type EnableResult, type PushConfig } from "./client";

const ERRORS: Record<Exclude<EnableResult, "ok">, MessageKey> = {
  "not-configured": "push.notConfigured",
  unsupported: "push.unsupported",
  denied: "push.denied",
  error: "push.error",
};

export function PushCard() {
  const { settings } = useApp();
  const t = useT();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchPushConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);

  if (!config) return null;

  const supported = pushSupported();
  const needsInstall = !supported && isIos() && !isStandalone();

  async function toggle(on: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      if (on) {
        const result = await enablePush();
        if (result !== "ok") setMessage(ERRORS[result]);
      } else {
        await disablePush();
      }
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage((await sendTestPush()) ? "push.testSent" : "push.error");
    setBusy(false);
  }

  if (!config.enabled) {
    return (
      <Card className="flex items-start gap-3">
        <CloudOff aria-hidden className="mt-0.5 size-6 shrink-0 text-muted" />
        <div>
          <h2 className="font-semibold">{t("push.title")}</h2>
          <p className="text-sm text-muted">{t("push.notConfigured")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("push.title")}</h2>
          <p className="text-sm text-muted">{t("push.body")}</p>
        </div>
        <Switch
          checked={settings.pushEnabled}
          onChange={toggle}
          label={t("push.title")}
        />
      </div>
      {needsInstall && <p className="text-sm text-warn">{t("push.iosInstall")}</p>}
      {!supported && !needsInstall && <p className="text-sm text-warn">{t("push.unsupported")}</p>}
      {settings.pushEnabled && (
        <Button disabled={busy} onClick={test}>
          <Send aria-hidden className="size-5" />
          {t("push.test")}
        </Button>
      )}
      {message && (
        <p role="status" className="text-sm font-medium">
          {t(message)}
        </p>
      )}
      <p className="text-xs text-muted">{t("push.privacy")}</p>
    </Card>
  );
}
