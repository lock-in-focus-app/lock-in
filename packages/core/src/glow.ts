// Glow colors (PLAN Phase 5): the color of the frames' corner ticks and the tabs' dot. Starlight
// is there from the start, and the rest come with huge lifetime milestones of focus, earned only
// by focusing. They're unlocked quietly: each one is just there in Settings next time you look.

export interface GlowColor {
  id: string;
  name: string;
  color: string;
  /** Lifetime focus hours it comes with. */
  hours: number;
}

export const glowColors: readonly GlowColor[] = [
  { id: 'starlight', name: 'Starlight', color: '#dce4ff', hours: 0 },
  { id: 'aurora', name: 'Aurora', color: '#94ecc4', hours: 100 },
  { id: 'nebula', name: 'Nebula', color: '#b9a4ff', hours: 500 },
  { id: 'dawn', name: 'Dawn', color: '#f4a9b8', hours: 1_000 },
  { id: 'sunlight', name: 'Sunlight', color: '#f5c86b', hours: 5_000 },
];

const hourMs = 3_600_000;

/** The glow colors that `focusedMs` of lifetime focus has unlocked, in the order they come. */
export function unlockedGlows(focusedMs: number): GlowColor[] {
  return glowColors.filter((glow) => glow.hours * hourMs <= focusedMs);
}

/** The next glow color to come, if there's one left. */
export function nextGlow(focusedMs: number): GlowColor | undefined {
  return glowColors.find((glow) => glow.hours * hourMs > focusedMs);
}

/** The glow color picked, or Starlight if it isn't unlocked yet (or isn't known). */
export function glowFor(id: string, focusedMs: number): GlowColor {
  return unlockedGlows(focusedMs).find((glow) => glow.id === id) ?? glowColors[0]!;
}
