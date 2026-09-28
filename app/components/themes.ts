import type { Story } from "@/lib/core/types";

/** Muted theme hues: distinct from each other and from the stamp violet, which stays reserved. */
const HUES = ["#4d6a8a", "#3e7c74", "#9a7433", "#9b5467", "#6b7a3a", "#5f6b7a"];

/** Themes in the order they first appear in the issue. Shared by server and client components. */
export function themesOf(stories: Story[]) {
  const order: string[] = [];
  for (const s of stories) {
    const t = s.theme ?? "Stories";
    if (!order.includes(t)) order.push(t);
  }
  return order;
}

export const themeColor = (themes: string[], theme?: string) => HUES[Math.max(0, themes.indexOf(theme ?? "Stories")) % HUES.length];
