import { describe, expect, it } from "vitest";
import { csvToObjects, parseCsv, toCsv, unguardText } from "@/features/backup/csv";
import { addLogicalDays, dayKey, formatElapsed, startOfLogicalDay } from "@/lib/time";

describe("csv", () => {
  it("quotes commas, quotes and newlines and round-trips", () => {
    const rows = [{ a: "plain", b: 'he said "hi", ok', c: "line1\nline2" }];
    const csv = toCsv(["a", "b", "c"], rows);
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["plain", 'he said "hi", ok', "line1\nline2"],
    ]);
  });

  it("guards text cells against spreadsheet formula injection and undoes it", () => {
    const csv = toCsv(["note"], [{ note: "=HYPERLINK(\"x\")" }, { note: "-5 ml" }, { note: "fine" }], ["note"]);
    const [, ...cells] = parseCsv(csv).map((r) => r[0]);
    expect(cells[0].startsWith("'=")).toBe(true);
    expect(cells[1].startsWith("'-")).toBe(true);
    expect(unguardText(cells[0])).toBe('=HYPERLINK("x")');
    expect(unguardText("it's")).toBe("it's");
  });

  it("does not guard numeric columns", () => {
    expect(toCsv(["n"], [{ n: -3 }])).toContain("\r\n-3\r\n");
  });

  it("handles BOM, CRLF and blank lines; lower-cases headers", () => {
    const objs = csvToObjects("\uFEFFID, Time_ISO\r\n1,2026-01-01\r\n\r\n2,2026-01-02\r\n");
    expect(objs).toEqual([
      { id: "1", time_iso: "2026-01-01" },
      { id: "2", time_iso: "2026-01-02" },
    ]);
  });
});

describe("time", () => {
  it("formats elapsed time compactly", () => {
    expect(formatElapsed(30_000)).toBe("<1m");
    expect(formatElapsed(12 * 60_000)).toBe("12m");
    expect(formatElapsed(125 * 60_000)).toBe("2h 05m");
  });

  it("groups a 2 AM feed with the previous day when the day starts at 6", () => {
    const at = Date.parse("2026-03-10T02:00:00Z");
    expect(dayKey(at, "UTC", 0)).toBe("2026-03-10");
    expect(dayKey(at, "UTC", 6)).toBe("2026-03-09");
  });

  it("buckets in the zone the entry was recorded in", () => {
    const at = Date.parse("2026-03-10T03:30:00Z"); // 23:30 on the 9th in New York (EDT)
    expect(dayKey(at, "America/New_York", 0)).toBe("2026-03-09");
    expect(dayKey(at, "Asia/Tokyo", 0)).toBe("2026-03-10");
  });

  it("logical days stay correct across a DST change", () => {
    // US clocks jump forward on 2026-03-08; that calendar day is only 23 hours long.
    const tz = "America/New_York";
    const todayStart = startOfLogicalDay(Date.parse("2026-03-09T16:00:00Z"), tz, 0);
    const yesterday = addLogicalDays(todayStart, tz, -1);
    expect(dayKey(yesterday, tz, 0)).toBe("2026-03-08");
    expect((todayStart - yesterday) / 3_600_000).toBe(23);
  });
});
