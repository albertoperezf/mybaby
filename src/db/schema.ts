import Dexie, { type Table } from "dexie";
import type {
  Baby,
  Diaper,
  DoctorVisit,
  Feeding,
  Measurement,
  Medication,
  Reminder,
  SettingRow,
  Sleep,
  Vaccine,
} from "./types";

export class AppDB extends Dexie {
  babies!: Table<Baby, string>;
  feedings!: Table<Feeding, string>;
  diapers!: Table<Diaper, string>;
  measurements!: Table<Measurement, string>;
  sleeps!: Table<Sleep, string>;
  medications!: Table<Medication, string>;
  vaccines!: Table<Vaccine, string>;
  visits!: Table<DoctorVisit, string>;
  reminders!: Table<Reminder, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = "mybaby") {
    super(name);
    // Add new versions below; never edit a shipped version. Indexes only, not fields.
    this.version(1).stores({
      babies: "id, archivedAt",
      feedings: "id, babyId, [babyId+at], updatedAt",
      diapers: "id, babyId, [babyId+at], updatedAt",
      measurements: "id, babyId, [babyId+measuredOn], updatedAt",
      sleeps: "id, babyId, [babyId+startedAt], updatedAt",
      medications: "id, babyId, [babyId+at], updatedAt",
      vaccines: "id, babyId, [babyId+dueOn], updatedAt",
      reminders: "id, babyId, nextFireAt, enabled",
      settings: "key",
    });
    this.version(2).stores({
      visits: "id, babyId, [babyId+visitedOn], updatedAt",
    });
  }
}

// Constructing is safe during SSR; nothing opens until the first query runs in the browser.
export const db = new AppDB();

/** Bump when the exported JSON shape changes. */
export const EXPORT_SCHEMA_VERSION = 2;
