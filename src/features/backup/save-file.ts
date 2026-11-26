/** Saves a file: native share sheet on mobile (lets iOS "Save to Files"), download link elsewhere. */
export async function saveFile(filename: string, content: string, mime: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([content], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
