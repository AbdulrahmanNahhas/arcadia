import type { CSSProperties } from "react";

const color = (value: string, fallback: string) =>
  /^#[\da-f]{6}$/i.test(value) ? value : fallback;

type PlanetPalette = CSSProperties & {
  "--planet": string;
  "--planet-secondary": string;
  "--planet-border": string;
};
/** Only validated catalog colors enter dynamic CSS variables; utilities own presentation. */
export function planetPalette(primary: string, secondary: string): PlanetPalette {
  return {
    "--planet": color(primary, "var(--accent)"),
    "--planet-secondary": color(secondary, "var(--panel)"),
    "--planet-border": color(primary, "var(--line)"),
  };
}
