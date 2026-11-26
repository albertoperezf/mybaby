// Canonical units everywhere: ml, grams, millimetres, epoch milliseconds (UTC).
export type ID = string; // ULID

export interface Base {
  id: ID;
  babyId: ID;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // tombstone: needed for undo, import merge and future sync
  deviceId?: string;
}

export type Sex = "female" | "male";

export interface Baby {
  id: ID;
  name: string;
  birthDate: string; // YYYY-MM-DD
  sex?: Sex; // only used to choose WHO curves
  gestationalWeeks?: number; // < 37 enables corrected age
  birthWeightG?: number;
  color: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  deviceId?: string;
}

export type FeedingKind = "bottle" | "breast" | "pump" | "solid";
export type MilkType = "formula" | "breastmilk" | "mixed";

export interface Feeding extends Base {
  kind: FeedingKind;
  at: number;
  tz: string; // IANA zone at the time of logging
  amountMl?: number;
  enteredUnit?: "oz" | "ml";
  milk?: MilkType;
  side?: "left" | "right" | "both";
  durationSec?: number;
  note?: string;
}

export type DiaperType = "wet" | "dirty" | "both" | "dry";

export interface Diaper extends Base {
  at: number;
  tz: string;
  type: DiaperType;
  note?: string;
}

export interface Measurement extends Base {
  measuredOn: string; // YYYY-MM-DD
  weightG?: number;
  lengthMm?: number;
  headMm?: number;
  source: "doctor" | "home";
  note?: string;
}

export interface Sleep extends Base {
  startedAt: number;
  endedAt?: number;
  tz: string;
  note?: string;
}

export interface Medication extends Base {
  name: string;
  dose: number;
  unit: string;
  at: number;
  tz: string;
  reminderId?: ID;
  note?: string;
}

export interface Vaccine extends Base {
  code: string;
  name: string;
  dueOn?: string;
  givenOn?: string;
  lot?: string;
  note?: string;
}

export type Schedule =
  | { type: "once"; at: number }
  | { type: "interval"; everyMin: number }
  | { type: "daily"; times: string[] } // "HH:mm", device-local
  | { type: "weekly"; days: number[]; times: string[] }; // days: 0 = Sunday

export type ReminderKind = "feeding-interval" | "medication" | "vitamin" | "appointment" | "custom";

export interface Reminder {
  id: ID;
  babyId?: ID;
  kind: ReminderKind;
  title: string;
  schedule: Schedule;
  enabled: boolean;
  respectQuietHours: boolean;
  nextFireAt?: number; // when it should next alert; past + not dismissed = due
  notifiedFor?: number; // nextFireAt value an OS notification was already shown for
  lastDismissedAt?: number;
  /** Device-local: scheduled Web Push deliveries for this reminder (never exported). */
  pushJobs?: { at: number; id: string }[];
  pushEndpoint?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  deviceId?: string;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string;
}

export type ThemeSetting = "system" | "light" | "dark" | "night";
export type Locale = "en" | "es";

export interface SettingsValues {
  deviceId: string;
  locale: Locale;
  theme: ThemeSetting;
  volumeUnit: "oz" | "ml";
  measureUnit: "imperial" | "metric";
  defaultIntervalMin: number;
  quietHours: QuietHours;
  dayStartHour: number;
  activeBabyId: ID | null;
  disclaimerAcceptedAt: number | null;
  lastBackupAt: number | null;
  installHintDismissedAt: number | null;
  backupNudgeSnoozedAt: number | null;
  pushEnabled: boolean;
}

export type SettingKey = keyof SettingsValues;

export interface SettingRow {
  key: SettingKey;
  value: unknown;
}

export const DATA_TABLES = [
  "babies",
  "feedings",
  "diapers",
  "measurements",
  "sleeps",
  "medications",
  "vaccines",
  "reminders",
] as const;
export type DataTableName = (typeof DATA_TABLES)[number];
