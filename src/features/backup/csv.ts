// Minimal RFC 4180 CSV writer/reader.

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Text cells that start with a formula character get a leading apostrophe (CSV injection guard). */
export function csvCell(value: unknown, isText = false): string {
  if (value === undefined || value === null) return "";
  let s = String(value);
  if (isText && FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[], textColumns: string[] = []): string {
  const text = new Set(textColumns);
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c], text.has(c))).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** Rows as objects keyed by (trimmed, lower-cased) header. */
export function csvToObjects(input: string): Record<string, string>[] {
  const [header, ...rest] = parseCsv(input);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** Undo the injection guard applied by `csvCell`. */
export function unguardText(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}
