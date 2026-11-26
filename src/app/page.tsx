import Link from "next/link";
import { BRAND } from "@/lib/brand";

const features = [
  ["Two-tap feeding log", "Presets for 2, 3, 4 oz and your last amount. Undo any mistake."],
  ["Smart reminders", "Next feeding timer with quiet hours, plus vitamins, medicine and appointments. Snooze or dismiss."],
  ["Growth with WHO curves", "Weight, length and head circumference plotted against WHO percentiles (0-5 years)."],
  ["Yours alone", "No account, no server database, no ads. Data lives on your device with JSON/CSV backup."],
  ["Built for 3 AM", "Big buttons, one-hand quick action, dark and red night modes. Works offline."],
  ["Bilingual", "English and Spanish."],
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-5 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">{BRAND.name}</h1>
        <p className="text-lg text-muted">{BRAND.description}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app"
            className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-primary-fg"
          >
            Open the app
          </Link>
          <Link href="/privacy" className="inline-flex min-h-12 items-center rounded-2xl border border-line px-6 font-medium">
            Privacy
          </Link>
        </div>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {features.map(([title, text]) => (
          <li key={title} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-muted">{text}</p>
          </li>
        ))}
      </ul>

      <footer className="text-sm text-muted">
        <p>
          Not medical advice. Percentiles are informational only; always talk to your pediatrician about your baby&apos;s
          health and growth.
        </p>
      </footer>
    </main>
  );
}
