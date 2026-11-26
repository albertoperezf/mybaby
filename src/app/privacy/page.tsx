import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-5 py-12 leading-relaxed">
      <Link href="/" className="text-primary underline">
        Back
      </Link>
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p>
        Everything you enter (babies, feedings, diapers, reminders, measurements, notes) is stored in your browser&apos;s
        IndexedDB on this device. It is never sent to a server. There are no accounts and no ads.
      </p>
      <h2 className="text-xl font-semibold">Backups</h2>
      <p>
        Because data lives only on your device, clearing browser data or losing the device deletes it. Use Settings →
        Backup to export a JSON or CSV file and keep it somewhere safe. Importing a file merges it back in.
      </p>
      <h2 className="text-xl font-semibold">Network</h2>
      <p>
        The site serves the app files and the anonymous statistics above; the app&apos;s content security policy blocks it
        from contacting any other server. Optional closed-app alerts (off by default, only if the site owner has set them up) send an
        anonymous push address and the times of your reminders to the site&apos;s server and a scheduling service so a
        notification can be delivered later. Baby names, notes and health data are never sent; the notification text is
        built on your device.
      </p>
      <h2 className="text-xl font-semibold">Site statistics</h2>
      <p>
        The site owner uses Vercel Web Analytics and Speed Insights to count visits and measure loading speed. They
        record page paths (for example /app/vaccines), country, browser, device type and performance timings. They use
        no cookies, do not follow you across sites and never see anything you enter in the app. The requests go to this
        site&apos;s own address, not to a third-party origin.
      </p>
      <h2 className="text-xl font-semibold">Medical disclaimer</h2>
      <p>
        This app is a personal log, not a medical device. Growth percentiles use the WHO Child Growth Standards for
        information only and do not diagnose anything. Contact your pediatrician with any concern, and call emergency
        services in an emergency.
      </p>
    </main>
  );
}
