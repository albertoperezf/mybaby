/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Reads one record straight from the app's IndexedDB; the worker can't use the app's Dexie layer.
function readRecord<T>(store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    const open = indexedDB.open("mybaby");
    // A missing database must not be created empty by the worker.
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const req = db.transaction(store).objectStore(store).get(key);
        req.onsuccess = () => {
          db.close();
          resolve(req.result as T | undefined);
        };
        req.onerror = () => {
          db.close();
          resolve(undefined);
        };
      } catch {
        db.close();
        resolve(undefined);
      }
    };
  });
}

const PUSH_TEXT = {
  en: { generic: "Reminder", feed: "Time to feed {name}", test: "Push notifications are working", open: "Tap to open" },
  es: { generic: "Recordatorio", feed: "Hora de dar de comer a {name}", test: "Las notificaciones push funcionan", open: "Toca para abrir" },
} as const;

async function showPushNotification(event: PushEvent) {
  let data: { reminderId?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Unreadable payload: still show something, as browsers require a visible notification per push.
  }
  const locale = (await readRecord<{ value: string }>("settings", "locale"))?.value === "es" ? "es" : "en";
  const text = PUSH_TEXT[locale];

  let title: string = text.generic;
  if (data.reminderId === "test") {
    title = text.test;
  } else if (data.reminderId) {
    const reminder = await readRecord<{ kind: string; title: string; babyId?: string; deletedAt?: number }>("reminders", data.reminderId);
    if (reminder && !reminder.deletedAt) {
      if (reminder.kind === "feeding-interval") {
        const baby = reminder.babyId ? await readRecord<{ name: string }>("babies", reminder.babyId) : undefined;
        title = text.feed.replace("{name}", baby?.name ?? "").trim();
      } else if (reminder.title) {
        title = reminder.title;
      }
    }
  }

  // Same tag as the in-app alert, so an open app and a push never show two notifications.
  await self.registration.showNotification(title, {
    body: text.open,
    tag: data.reminderId ?? "mybaby",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    data: { url: "/app" },
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event));
});

// Reminder notifications are shown by the page; tapping one focuses (or opens) the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? "/app/reminders";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target).catch(() => undefined);
      } else {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
