import { beforeEach, describe, expect, it } from "vitest";
import { addBaby } from "@/db/repo";
import { db } from "@/db/schema";
import type { Baby, Vaccine } from "@/db/types";
import { buildCsv } from "@/features/backup/export";
import { importCsvText } from "@/features/backup/import";
import { buildDoses, doseStatus, earliestOn, groupDoses, indexByCode, monthsToDate, rebaseDoses, summarize } from "@/features/vaccines/logic";
import { plannedVisits, syncVaccineReminders } from "@/features/vaccines/reminders";
import { addCustomDose, applySchedule, markGiven, rebaseForBaby, skipDose, unmarkGiven } from "@/features/vaccines/repo";
import { ES_SCHEDULE, SCHEDULES, US_SCHEDULE, VACCINES } from "@/features/vaccines/schedule-data";

const BIRTH = "2026-01-15";

const make = (over: Partial<Vaccine>): Vaccine => ({ id: over.code ?? "x", babyId: "b", code: "x", name: "", createdAt: 0, updatedAt: 0, ...over });

describe("schedule data integrity", () => {
  for (const def of Object.values(SCHEDULES)) {
    describe(def.id, () => {
      it("has unique codes, valid references and sane windows", () => {
        const codes = new Set<string>();
        for (const d of def.doses) {
          expect(codes.has(d.code), `duplicate ${d.code}`).toBe(false);
          codes.add(d.code);
          expect(d.to, d.code).toBeGreaterThan(d.from);
          expect(VACCINES[d.vaccine], `${d.code} vaccine info`).toBeDefined();
          expect(d.code.startsWith(d.vaccine.replace("hexa", "hexa")), d.code).toBe(true);
        }
        for (const d of def.doses.filter((x) => x.after)) {
          const prev = def.doses.find((x) => x.code === d.after);
          expect(prev, `${d.code} after ${d.after}`).toBeDefined();
          expect(prev!.from, `${d.code} must come after ${d.after}`).toBeLessThanOrEqual(d.from);
          expect(d.minGapDays, d.code).toBeGreaterThan(0);
        }
      });

      it("has English and Spanish text for everything shown", () => {
        for (const d of def.doses) {
          const v = VACCINES[d.vaccine];
          expect(v.name.en && v.name.es && v.protects.en && v.protects.es).toBeTruthy();
          if (d.note) expect(d.note.en && d.note.es).toBeTruthy();
        }
        expect(def.name.en && def.name.es && def.source.en && def.source.es && def.url.startsWith("https://")).toBeTruthy();
        def.notes.forEach((n) => expect(n.en && n.es).toBeTruthy());
      });
    });
  }

  it("covers the key infant vaccines of each schedule", () => {
    const us = new Set(US_SCHEDULE.doses.map((d) => d.vaccine));
    for (const v of ["hepb", "rv", "dtap", "hib", "pcv", "ipv", "mmr", "var", "hepa", "flu", "rsv"]) expect(us.has(v), `us ${v}`).toBe(true);
    const es = new Set(ES_SCHEDULE.doses.map((d) => d.vaccine));
    for (const v of ["hexa", "pcv", "rv", "menb", "mmr", "var", "rsv"]) expect(es.has(v), `es ${v}`).toBe(true);
  });

  it("matches the published dose counts (CDC: DTaP 5, PCV 4, IPV 4; AEP: hexavalent 3, MenB 3)", () => {
    const count = (def: typeof US_SCHEDULE, v: string) => def.doses.filter((d) => d.vaccine === v).length;
    expect(count(US_SCHEDULE, "dtap")).toBe(5);
    expect(count(US_SCHEDULE, "pcv")).toBe(4);
    expect(count(US_SCHEDULE, "ipv")).toBe(4);
    expect(count(US_SCHEDULE, "hepb")).toBe(3);
    expect(count(ES_SCHEDULE, "hexa")).toBe(3);
    expect(count(ES_SCHEDULE, "menb")).toBe(3);
  });
});

describe("dates", () => {
  it("adds calendar months and half months to the birth date", () => {
    expect(monthsToDate("2026-01-15", 2)).toBe("2026-03-15");
    expect(monthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(monthsToDate("2026-01-15", 1.5)).toBe("2026-03-02"); // one month, then 15 days
    expect(monthsToDate("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("builds dated doses from a schedule", () => {
    const doses = buildDoses(US_SCHEDULE, BIRTH);
    expect(doses).toHaveLength(US_SCHEDULE.doses.length);
    const dtap3 = doses.find((d) => d.code === "dtap-3")!;
    expect(dtap3).toMatchObject({ dueOn: "2026-07-15", windowFrom: "2026-07-15", windowTo: "2026-08-15", scheduleId: "us", afterCode: "dtap-2" });
  });
});

describe("status and gaps", () => {
  const doses = buildDoses(US_SCHEDULE, BIRTH).map((d, i) => make({ ...d, id: `id${i}` }));
  const byCode = indexByCode(doses);
  const get = (code: string) => byCode.get(code)!;

  it("upcoming, due and past around the recommended window", () => {
    expect(doseStatus(get("dtap-1"), byCode, "2026-02-01")).toBe("upcoming");
    expect(doseStatus(get("dtap-1"), byCode, "2026-03-15")).toBe("due");
    expect(doseStatus(get("dtap-1"), byCode, "2026-04-15")).toBe("due");
    expect(doseStatus(get("dtap-1"), byCode, "2026-04-16")).toBe("past");
  });

  it("given and skipped override timing", () => {
    expect(doseStatus({ ...get("dtap-1"), givenOn: "2026-03-20" }, byCode, "2030-01-01")).toBe("given");
    expect(doseStatus({ ...get("dtap-1"), skippedOn: "2026-03-20" }, byCode, "2030-01-01")).toBe("skipped");
  });

  it("pushes a dose later when the previous one was given late (minimum gap)", () => {
    const lateByCode = indexByCode(doses.map((d) => (d.code === "dtap-1" ? { ...d, givenOn: "2026-04-10" } : d)));
    const dtap2 = lateByCode.get("dtap-2")!;
    // Given 5 weeks early relative to the window, 28 days later is still before the window start, so the window wins.
    expect(earliestOn(dtap2, lateByCode)).toBe("2026-05-15");
    expect(earliestOn(get("dtap-2"), byCode)).toBe("2026-05-15");
    // given 2 months late the minimum gap moves the date beyond the window start
    const veryLate = indexByCode(doses.map((d) => (d.code === "dtap-1" ? { ...d, givenOn: "2026-05-10" } : d)));
    expect(earliestOn(veryLate.get("dtap-2")!, veryLate)).toBe("2026-06-07");
    expect(doseStatus(veryLate.get("dtap-2")!, veryLate, "2026-05-20")).toBe("upcoming");
  });
});

describe("grouping and summary", () => {
  const doses = buildDoses(US_SCHEDULE, BIRTH).map((d, i) => make({ ...d, id: `id${i}` }));

  it("groups by recommended age in order, optional doses last within a group", () => {
    const groups = groupDoses(doses, BIRTH);
    expect(groups.map((g) => g.ageMonths)).toEqual([...new Set(groups.map((g) => g.ageMonths))].sort((a, b) => a - b));
    expect(groups[0].ageMonths).toBe(0);
    const two = groups.find((g) => g.ageMonths === 2)!;
    expect(two.doses.map((d) => d.vaccine)).toEqual(expect.arrayContaining(["rv", "dtap", "hib", "pcv", "ipv"]));
    const six = groups.find((g) => g.ageMonths === 6)!;
    const firstOptional = six.doses.findIndex((d) => d.optional);
    expect(six.doses.slice(firstOptional).every((d) => d.optional)).toBe(true);
  });

  it("custom entries go in their own last group", () => {
    const groups = groupDoses([...doses, make({ id: "c", code: "custom-1", scheduleId: "custom", name: "BCG", dueOn: "2026-02-01" })], BIRTH);
    expect(groups[groups.length - 1].ageMonths).toBe(-1);
  });

  it("summary counts only required doses and reports what is due or past", () => {
    const s0 = summarize(doses, "2026-01-16");
    expect(s0.expected).toBeGreaterThan(0);
    expect(s0.expectedGiven).toBe(0);
    expect(s0.next).toBeDefined();

    const giveAllExpected = doses.map((d) => (!d.optional && (d.windowFrom ?? "") <= "2026-03-20" ? { ...d, givenOn: "2026-03-20" } : d));
    const s1 = summarize(giveAllExpected, "2026-03-20");
    expect(s1.expectedGiven).toBe(s1.expected);
    expect(s1.past).toHaveLength(0);
    expect(s1.dueNow).toHaveLength(0);

    const s2 = summarize(doses, "2026-12-01"); // nothing given a year later
    expect(s2.past.length).toBeGreaterThan(5);
    expect(s2.past.every((d) => !d.optional)).toBe(true);
  });

  it("re-anchors untouched doses when the birth date changes, leaving given ones alone", () => {
    const withGiven = doses.map((d) => (d.code === "dtap-1" ? { ...d, givenOn: "2026-03-16" } : d));
    const changes = rebaseDoses(withGiven, US_SCHEDULE, "2026-02-15");
    expect(changes.has(withGiven.find((d) => d.code === "dtap-1")!.id)).toBe(false);
    expect(changes.get(withGiven.find((d) => d.code === "dtap-2")!.id)).toMatchObject({ dueOn: "2026-06-15" });
  });
});

describe("repository", () => {
  let baby: Baby;

  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    baby = await addBaby({ name: "Ada", birthDate: BIRTH });
  });

  const live = async () => (await db.vaccines.toArray()).filter((v) => !v.deletedAt);

  it("applies a schedule, recording the choice on the baby", async () => {
    await applySchedule(baby, "us");
    expect(await live()).toHaveLength(US_SCHEDULE.doses.length);
    expect((await db.babies.get(baby.id))!.vaccineSchedule).toBe("us");
    expect((await live())[0].deviceId).toBeTruthy();
  });

  it("marks doses given and not given, and skips", async () => {
    await applySchedule(baby, "us");
    const dtap1 = (await live()).find((v) => v.code === "dtap-1")!;
    await markGiven(dtap1.id, { givenOn: "2026-03-16", lot: " AB12 ", provider: "Clinic", note: "" });
    expect(await db.vaccines.get(dtap1.id)).toMatchObject({ givenOn: "2026-03-16", lot: "AB12", provider: "Clinic" });
    expect((await db.vaccines.get(dtap1.id))!.note).toBeUndefined();
    await unmarkGiven(dtap1.id);
    expect((await db.vaccines.get(dtap1.id))!.givenOn).toBeUndefined();

    await skipDose(dtap1.id, "2026-03-16", "declined");
    expect(await db.vaccines.get(dtap1.id)).toMatchObject({ skippedOn: "2026-03-16", note: "declined" });
  });

  it("switching schedule keeps given, skipped and custom doses and replaces the rest", async () => {
    await applySchedule(baby, "us");
    const all = await live();
    await markGiven(all.find((v) => v.code === "mmr-1")!.id, { givenOn: "2027-01-20" });
    await skipDose(all.find((v) => v.code === "flu-1")!.id, "2026-10-01");
    await addCustomDose(baby.id, { name: "BCG", givenOn: "2026-01-20" });

    await applySchedule(baby, "es");
    const after = await live();
    expect(after.filter((v) => v.scheduleId === "us").map((v) => v.code).sort()).toEqual(["flu-1", "mmr-1"]);
    expect(after.some((v) => v.scheduleId === "custom" && v.name === "BCG")).toBe(true);
    // Spanish doses added, except codes already kept (mmr-1, flu-1) so nothing is duplicated.
    expect(after.filter((v) => v.code === "mmr-1")).toHaveLength(1);
    expect(after.filter((v) => v.code === "flu-1")).toHaveLength(1);
    expect(after.some((v) => v.code === "hexa-1" && v.scheduleId === "es")).toBe(true);
    expect(after.some((v) => v.code === "dtap-1" && v.scheduleId === "us")).toBe(false);

    await applySchedule(baby, "none");
    const none = await live();
    expect(none.every((v) => v.givenOn || v.skippedOn || v.scheduleId === "custom")).toBe(true);
  });

  it("moves untouched doses when the birth date is corrected", async () => {
    await applySchedule(baby, "us");
    await rebaseForBaby({ id: baby.id, birthDate: "2026-02-15", vaccineSchedule: "us" });
    expect((await live()).find((v) => v.code === "dtap-2")!.dueOn).toBe("2026-06-15");
  });

  it("round-trips through CSV", async () => {
    await applySchedule(baby, "us");
    const dtap1 = (await live()).find((v) => v.code === "dtap-1")!;
    await markGiven(dtap1.id, { givenOn: "2026-03-16", lot: "=EVIL", note: "ok, fine" });
    const csv = await buildCsv("vaccines");
    expect(csv).toContain("'=EVIL");

    await db.vaccines.clear();
    const res = await importCsvText(csv, baby.id);
    expect(res.kind).toBe("vaccines");
    expect(res.invalid).toBe(0);
    expect(res.added).toBe(US_SCHEDULE.doses.length);
    const restored = (await live()).find((v) => v.code === "dtap-1")!;
    expect(restored).toMatchObject({ givenOn: "2026-03-16", lot: "=EVIL", note: "ok, fine", afterCode: undefined });
    expect((await live()).find((v) => v.code === "dtap-2")).toMatchObject({ afterCode: "dtap-1", minGapDays: 28 });
  });
});

describe("visit reminders", () => {
  const NOW = Date.parse("2026-03-01T12:00:00Z"); // TZ=UTC in vitest config
  const doses = buildDoses(US_SCHEDULE, BIRTH).map((d, i) => make({ ...d, id: `id${i}`, babyId: "b1" }));

  it("plans one reminder per upcoming visit date, a week before at 9 AM, required doses only", () => {
    const visits = plannedVisits("b1", doses, "2026-03-01", NOW);
    expect(visits.length).toBeGreaterThan(2);
    const first = visits[0];
    expect(first.dueOn).toBe("2026-03-15"); // the 2-month visit
    expect(first.at).toBe(Date.parse("2026-03-08T09:00:00Z"));
    expect(first.doses.map((d) => d.vaccine)).toEqual(expect.arrayContaining(["dtap", "hib", "pcv", "ipv", "rv"]));
    expect(visits.flatMap((v) => v.doses).some((d) => d.optional)).toBe(false);
    expect(first.key).toBe("vaccine:b1:2026-03-15");
  });

  it("reminds at the next 9 AM when the week-before moment has already passed", () => {
    const visits = plannedVisits("b1", doses, "2026-03-12", Date.parse("2026-03-12T10:00:00Z"));
    expect(visits[0].dueOn).toBe("2026-03-15");
    expect(visits[0].at).toBe(Date.parse("2026-03-13T09:00:00Z"));
  });

  it("skips given, skipped and past-window doses", () => {
    const given = doses.map((d) => (d.windowFrom === "2026-03-15" ? { ...d, givenOn: "2026-03-15" } : d));
    expect(plannedVisits("b1", given, "2026-03-01", NOW).some((v) => v.dueOn === "2026-03-15")).toBe(false);
    expect(plannedVisits("b1", doses, "2027-06-01", Date.parse("2027-06-01T12:00:00Z")).every((v) => v.dueOn >= "2027-06-01")).toBe(true);
  });

  describe("sync", () => {
    beforeEach(async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
    const title = (v: { dueOn: string; doses: Vaccine[] }) => `Vaccines ${v.dueOn}: ${v.doses.length}`;
    const reminders = async () => (await db.reminders.toArray()).filter((r) => !r.deletedAt);

    it("creates, keeps (even when dismissed), re-titles and removes reminders", async () => {
      await syncVaccineReminders({ id: "b1" }, doses, true, title, NOW);
      const created = await reminders();
      expect(created.length).toBeGreaterThan(2);
      expect(created.every((r) => r.kind === "vaccine" && r.schedule.type === "once" && r.enabled)).toBe(true);

      // A dismissed reminder must not come back on the next sync.
      await db.reminders.update(created[0].id, { enabled: false });
      await syncVaccineReminders({ id: "b1" }, doses, true, title, NOW + 60_000);
      expect((await db.reminders.get(created[0].id))!.enabled).toBe(false);
      expect(await reminders()).toHaveLength(created.length);

      await syncVaccineReminders({ id: "b1" }, doses, true, (v) => `New ${v.dueOn}`, NOW + 120_000);
      expect((await reminders())[0].title.startsWith("New")).toBe(true);

      // Giving the 2-month doses removes that visit's reminder.
      const given = doses.map((d) => (d.windowFrom === "2026-03-15" ? { ...d, givenOn: "2026-03-15" } : d));
      await syncVaccineReminders({ id: "b1" }, given, true, title, NOW + 180_000);
      expect((await reminders()).some((r) => r.autoKey === "vaccine:b1:2026-03-15")).toBe(false);

      await syncVaccineReminders({ id: "b1" }, given, false, title, NOW + 240_000);
      expect(await reminders()).toHaveLength(0);
    });
  });
});
