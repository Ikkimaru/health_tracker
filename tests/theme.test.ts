import { describe, expect, it } from "vitest";
import {
  darkTheme,
  defaultCustomTheme,
  lightTheme,
  resolveTheme,
  themeVariables
} from "../src/application/theme";

describe("theme selection", () => {
  it("makes system mode follow the device preference", () => {
    const settings = { displayName: "Adventurer", theme: "system" as const };
    expect(resolveTheme(settings, false)).toEqual(lightTheme);
    expect(resolveTheme(settings, true)).toEqual(darkTheme);
  });

  it("uses every saved custom color without changing the defaults", () => {
    const custom = defaultCustomTheme();
    custom.background = "#123456";
    custom.accent = "#abcdef";
    const resolved = resolveTheme({
      displayName: "Adventurer",
      theme: "custom",
      customTheme: custom
    });
    expect(resolved.background).toBe("#123456");
    expect(resolved.accent).toBe("#abcdef");
    expect(lightTheme.background).toBe("#f4f1e8");
  });

  it("maps every customizable color to a CSS variable", () => {
    expect(Object.keys(themeVariables).sort()).toEqual(Object.keys(defaultCustomTheme()).sort());
  });
});
