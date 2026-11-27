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
  avatar?: string; // a single emoji
  vaccineSchedule?: VaccineScheduleId | "none";
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

export interface VisitQuestion {
  id: string;
  text: string;
  done: boolean;
}

export interface DoctorVisit extends Base {
  visitedOn: string; // YYYY-MM-DD
  reason: string;
  provider?: string;
  questions: VisitQuestion[];
  summary?: string;
  followUpOn?: string; // YYYY-MM-DD
  reminderId?: ID;
}

export interface Vaccine extends Base {
  /** Stable dose key from the schedule, e.g. "dtap-3"; random for custom entries. */
  code: string;
  /** Vaccine key used to look up names and descriptions; empty for custom entries. */
  vaccine?: string;
  dose?: number;
  scheduleId?: VaccineScheduleId | "custom";
  name: string;
  dueOn?: string; // scheduled/appointment date, editable
  windowFrom?: string; // recommended range from the schedule
  windowTo?: string;
  /** Earliest allowed date is this many days after the previous dose (`afterCode`). */
  afterCode?: string;
  minGapDays?: number;
  optional?: boolean; // "if your brand needs it", seasonal or shared-decision doses
  givenOn?: string;
  skippedOn?: string;
  lot?: string;
  provider?: string;
  note?: string;
}

export type VaccineScheduleId = "us" | "es";

export type Schedule =
  | { type: "once"; at: number }
  | { type: "interval"; everyMin: number }
  | { type: "daily"; times: string[] } // "HH:mm", device-local
  | { type: "weekly"; days: number[]; times: string[] }; // days: 0 = Sunday

export type ReminderKind = "feeding-interval" | "medication" | "vitamin" | "appointment" | "vaccine" | "custom";

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
  /** Set on reminders the app manages itself (e.g. vaccine visits), so they can be updated in place. */
  autoKey?: string;
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
  nightAuto: boolean;
  vaccineReminders: boolean;
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
  "visits",
  "reminders",
] as const;
export type DataTableName = (typeof DATA_TABLES)[number];
