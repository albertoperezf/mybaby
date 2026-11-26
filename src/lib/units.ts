const OZ_TO_ML = 29.5735295625;
const G_PER_OZ = 28.349523125;
const MM_PER_IN = 25.4;

export const ozToMl = (oz: number) => oz * OZ_TO_ML;
export const mlToOz = (ml: number) => ml / OZ_TO_ML;

const round = (n: number, step: number) => Math.round(n / step) * step;
const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** Volume in the user's unit: oz snaps to quarter-ounces, ml to whole numbers. */
export function formatVolume(ml: number, unit: "oz" | "ml"): string {
  if (unit === "ml") return `${Math.round(ml)} ml`;
  return `${trim(round(mlToOz(ml), 0.25), 2)} oz`;
}

export function volumeNumber(ml: number, unit: "oz" | "ml"): number {
  return unit === "ml" ? Math.round(ml) : Number(trim(round(mlToOz(ml), 0.25), 2));
}

export function toMl(value: number, unit: "oz" | "ml"): number {
  return unit === "oz" ? ozToMl(value) : value;
}

export const lbOzToG = (lb: number, oz: number) => Math.round((lb * 16 + oz) * G_PER_OZ);
export const kgToG = (kg: number) => Math.round(kg * 1000);
export const inToMm = (inches: number) => Math.round(inches * MM_PER_IN);
export const cmToMm = (cm: number) => Math.round(cm * 10);

export function gToLbOz(g: number): { lb: number; oz: number } {
  const totalOz = round(g / G_PER_OZ, 0.1);
  let lb = Math.floor(totalOz / 16);
  let oz = Number((totalOz - lb * 16).toFixed(1));
  if (oz >= 16) {
    lb += 1;
    oz = 0;
  }
  return { lb, oz };
}

export function formatWeight(g: number, unit: "imperial" | "metric"): string {
  if (unit === "metric") return `${trim(g / 1000, 2)} kg`;
  const { lb, oz } = gToLbOz(g);
  return `${lb} lb ${trim(oz, 1)} oz`;
}

export function formatLength(mm: number, unit: "imperial" | "metric"): string {
  return unit === "metric" ? `${trim(mm / 10, 1)} cm` : `${trim(mm / MM_PER_IN, 1)} in`;
}

export function lengthValue(mm: number, unit: "imperial" | "metric"): number {
  return Number(trim(unit === "metric" ? mm / 10 : mm / MM_PER_IN, 2));
}

export const lengthUnitLabel = (unit: "imperial" | "metric") => (unit === "metric" ? "cm" : "in");
