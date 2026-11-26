// Generates PWA icons and iOS splash screens into public/icons (run: npm run icons).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public/icons");
const BRAND = "#4f46e5";
const SPLASH_BG = "#0b0d12"; // dark on purpose: no white flash at 3 AM

// scale < 1 shrinks the moon into the maskable safe zone.
const moon = (size, scale = 1) => {
  const c = size / 2;
  const r = size * 0.23 * scale;
  return `
    <mask id="m"><rect width="${size}" height="${size}" fill="white"/>
      <circle cx="${c + r * 0.55}" cy="${c - r * 0.4}" r="${r * 0.88}" fill="black"/></mask>
    <circle cx="${c}" cy="${c}" r="${r}" fill="#fff" mask="url(#m)"/>
    <circle cx="${c + r * 0.95}" cy="${c + r * 0.75}" r="${r * 0.07}" fill="#fff"/>
    <circle cx="${c + r * 0.55}" cy="${c + r * 1.1}" r="${r * 0.045}" fill="#fff"/>`;
};

const iconSvg = (size, scale) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${BRAND}"/>${moon(size, scale)}</svg>`,
  );

const splashSvg = (w, h) => {
  const s = Math.round(Math.min(w, h) * 0.28);
  const x = Math.round((w - s) / 2);
  const y = Math.round((h - s) / 2);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="${w}" height="${h}" fill="${SPLASH_BG}"/>
      <svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
        <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${BRAND}"/>${moon(s, 1)}</svg></svg>`,
  );
};

// [css width, css height, device pixel ratio]
export const SPLASH_SIZES = [
  [440, 956, 3],
  [430, 932, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [428, 926, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 812, 3],
  [414, 736, 3],
  [375, 667, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

await mkdir(OUT, { recursive: true });

const png = (svg, file, size) =>
  sharp(svg, { density: 300 }).resize(size.w, size.h ?? size.w).png({ compressionLevel: 9 }).toFile(path.join(OUT, file));

await png(iconSvg(512, 1), "icon-512.png", { w: 512 });
await png(iconSvg(192, 1), "icon-192.png", { w: 192 });
await png(iconSvg(512, 0.62), "icon-maskable-512.png", { w: 512 });
await png(iconSvg(180, 1), "apple-touch-icon.png", { w: 180 });
await png(iconSvg(32, 1), "favicon-32.png", { w: 32 });

const manifest = [];
for (const [cw, ch, dpr] of SPLASH_SIZES) {
  const w = cw * dpr;
  const h = ch * dpr;
  const file = `splash-${w}x${h}.png`;
  await png(splashSvg(w, h), file, { w, h });
  manifest.push({ file: `/icons/${file}`, cw, ch, dpr });
}
await writeFile(path.join(OUT, "splash.json"), JSON.stringify(manifest));
console.log("icons written to", OUT);
