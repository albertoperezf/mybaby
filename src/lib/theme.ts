export type ResolvedTheme = "light" | "dark" | "night";

const BROWSER_CHROME: Record<ResolvedTheme, string> = {
  light: "#fff8f1",
  dark: "#14121f",
  night: "#000000",
};

/** Sets the theme on <html> and keeps the browser/status-bar colour in sync. */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BROWSER_CHROME[theme]));
}
