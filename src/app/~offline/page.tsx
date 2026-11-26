import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">This page hasn&apos;t been saved for offline use yet. Open the app once while online.</p>
      {/* A hard navigation: the service worker serves the cached app shell. */}
      <a href="/app" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-primary-fg">
        Open the app
      </a>
    </main>
  );
}
