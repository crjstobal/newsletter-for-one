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

/** Topics to start from when signing up. Each fills the description, which the reader then refines. */
export const TOPICS = [
  { label: "AI", text: "AI news that matters: new models and what they're good at, tools I can actually use, and the big industry moves. Skip hype and funding gossip." },
  { label: "Apple", text: "Apple: product launches, OS updates and features worth knowing, plus the best rumors from reliable sources." },
  { label: "Marketing", text: "Marketing for a small business: changes on Google, Meta and TikTok that affect ads and reach, useful case studies, and new tools." },
  { label: "Video editing", text: "I edit YouTube videos with Final Cut Pro. Every week: FCP updates, new plugins and templates, useful tutorials, and what the community is talking about." },
  { label: "Game dev", text: "Indie game dev with Godot: engine releases, notable open-source addons, postmortems and game jam results." },
  { label: "Startups", text: "Startups and tech business: notable launches, what founders are learning, and the deals that change a market." },
  { label: "Personal finance", text: "Personal finance and investing in Spain: tax changes, index funds, interest rates and what they mean for my savings." },
  { label: "Science", text: "Science news explained: space, physics, biology and health studies that are actually new, with what they really found." },
  { label: "Electric cars", text: "Everything new about affordable electric cars in Spain: launches, real prices, government incentives and charging network news." },
  { label: "Coffee", text: "Home espresso nerd: new grinders and machines under 1500 EUR, firmware updates, and technique discussions." },
  { label: "Design", text: "Product and UI design: new Figma features, design systems, notable redesigns and what good teams are writing about craft." },
] as const;
