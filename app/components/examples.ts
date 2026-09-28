/** Starter descriptions shown on the homepage and the newsletters page. */
export const EXAMPLES = [
  {
    label: "Final Cut Pro",
    text: "I edit YouTube videos with Final Cut Pro. Every week: FCP updates, new plugins and templates, useful tutorials, and what the community is talking about.",
  },
  {
    label: "Cheap EVs in Spain",
    text: "Everything new about affordable electric cars in Spain: launches, real prices, government incentives and charging network news.",
  },
  {
    label: "Godot game dev",
    text: "Indie game dev with Godot: engine releases, notable open-source addons, postmortems and game jam results.",
  },
  {
    label: "Home espresso",
    text: "Home espresso nerd: new grinders and machines under 1500 EUR, firmware updates, and technique discussions.",
  },
];

export const LANGUAGES = [
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["el", "Ελληνικά"],
] as const;

export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(LANGUAGES);
