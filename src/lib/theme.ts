export type ResolvedTheme = "light" | "dark" | "night";

const BROWSER_CHROME: Record<ResolvedTheme, string> = {
  light: "#faf9f7",
  dark: "#0b0d12",
  night: "#000000",
};

/** Sets the theme on <html> and keeps the browser/status-bar colour in sync. */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BROWSER_CHROME[theme]));
}
