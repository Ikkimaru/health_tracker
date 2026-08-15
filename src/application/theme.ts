import type { AppSettings, ThemeColors } from "../domain/types";

export const lightTheme: ThemeColors = {
  background: "#f4f1e8",
  surface: "#fffdf7",
  text: "#173329",
  mutedText: "#66756f",
  accent: "#d99025",
  accentText: "#241905",
  border: "#d8d8ca",
  hero: "#16382c",
  heroText: "#f6f4ea",
  success: "#2d7158",
  noticeBackground: "#fff0bd",
  noticeText: "#5a4300"
};

export const darkTheme: ThemeColors = {
  background: "#102a22",
  surface: "#183a30",
  text: "#edf5ee",
  mutedText: "#aab9b1",
  accent: "#f0b84d",
  accentText: "#241905",
  border: "#36584c",
  hero: "#0b211a",
  heroText: "#f6f4ea",
  success: "#58a985",
  noticeBackground: "#4c3a08",
  noticeText: "#fff0bd"
};

export const defaultCustomTheme = (): ThemeColors => ({ ...lightTheme });

export const themeVariables: Record<keyof ThemeColors, string> = {
  background: "--background",
  surface: "--paper",
  text: "--ink",
  mutedText: "--muted",
  accent: "--accent",
  accentText: "--accent-text",
  border: "--line",
  hero: "--hero",
  heroText: "--hero-text",
  success: "--success",
  noticeBackground: "--notice-bg",
  noticeText: "--notice-text"
};

export const themeLabels: Record<keyof ThemeColors, string> = {
  background: "Page background",
  surface: "Cards and fields",
  text: "Main text",
  mutedText: "Secondary text",
  accent: "Buttons and highlights",
  accentText: "Text on buttons",
  border: "Borders",
  hero: "Today banner",
  heroText: "Text on banner",
  success: "Completed items",
  noticeBackground: "Notice background",
  noticeText: "Notice text"
};

export function resolveTheme(settings: AppSettings, prefersDark = false): ThemeColors {
  if (settings.theme === "light") return lightTheme;
  if (settings.theme === "dark") return darkTheme;
  if (settings.theme === "custom") return settings.customTheme ?? defaultCustomTheme();
  return prefersDark ? darkTheme : lightTheme;
}

export function applyThemeVariables(target: HTMLElement, colors: ThemeColors): void {
  for (const [key, variable] of Object.entries(themeVariables)) {
    target.style.setProperty(variable, colors[key as keyof ThemeColors]);
  }
}
