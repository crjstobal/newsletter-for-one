/** Tooltip copy, in one place so it stays consistent across the app. */
export const HELP = {
  window:
    "The date range this issue covers. It starts at the previous issue's date (or 8 days back for a weekly, 2 for a daily, on the first issue) and ends today. Anything published before it is dropped.",
  plan:
    "Nemotron 3.5 Lightning reads your brief, what you liked and disliked, and every story already sent, then decides what to search for this issue. Its 1M-token context lets it see your whole history.",
  subscriptions:
    "Your own newsletters, podcasts and feeds: everything they published in the window is split into separate pieces of news by Nemotron 3 Nano with reasoning turned off (a mechanical job, about 100 times fewer tokens), cached per item, then merged with the web results. The same news from several sources becomes one story that says who else covered it.",
  search:
    "Tavily runs every planned search on the live web, restricted to the window. 'news' searches press, 'web' blogs and official sites, 'reddit' and 'youtube' only those sites, 'sources' only your preferred sources. Advanced depth costs 2 credits per search.",
  triage:
    "Nemotron 3 Nano, the cheapest model, reads every unique result in parallel batches of 20 and scores it 0 to 10 for this reader. It also labels the real-world event behind it, so different articles about the same thing can be grouped.",
  dates:
    "For every promising result without a search-engine date, the page itself is opened and reads its real publication date: YouTube's upload date, or the page's own metadata elsewhere. Reddit is never contacted: it blocks automated access without an API key. No model, no guessing. Free.",
  filter:
    "Plain rules, no AI: drop results older than the window, without a verifiable date, below the score threshold, from blocked domains, or about an event you already received. The best remaining results form the shortlist.",
  memory:
    "Nemotron 3.5 Lightning reads every story you were ever sent (it fits in its 1M-token context) and this issue's candidates, and drops anything that is the same news, however it's worded. It also keeps only the best source when several candidates report the same thing.",
  edit:
    "Nemotron 3 Ultra, NVIDIA's largest model, writes the issue using only the shortlisted sources. It merges sources about the same event into one story, and links always come from the search results, never from the model.",
  learning:
    "When you vote on stories, Nemotron 3.5 Lightning turns your reactions into general likes and dislikes that steer the next issue's searches and editing.",
  checks:
    "Automatic checks on the finished issue: dates, number of stories, source diversity and failed searches. Yellow means look before trusting it; red means something is wrong.",
  cost:
    "Nebius cost uses the live per-token prices Token Factory publishes for each model. Tavily cost is credits used at the pay-as-you-go rate ($0.008 per credit).",
  candidates:
    "Every unique result the searches returned, and what happened to it. Use it to see why something was or was not included, and to block or prefer a source.",
  routing:
    "Each job goes to the cheapest Nemotron that does it well: Nano for the many small calls, Lightning where the whole history must fit in context, Ultra only for the writing the reader sees. Bars are each model's share of the Nemotron cost. The comparison prices the same tokens at Ultra's live Token Factory rate.",
  llmCalls: "Every call made to Nebius Token Factory for this issue, with the model, tokens and cost.",
  dateOrigin:
    "Green: inside the window. Red: older. '✓': verified on the page itself. Plain: from the search engine. '≈ in window': no exact date (Reddit), but the search engine only returns posts from the window. Dashed: the model read it from the text (weakest). 'no date': nobody could tell. Hover a date to see where it came from.",
  allowUndated:
    "Off (recommended): results whose publication date can't be verified are dropped, so every story is provably recent. On: they are kept and flagged, useful for topics where many good sources don't publish dates.",
  score: "Triage score 0 to 10. Results need at least 6 to be considered.",
  foundBy: "Which searches (by number) returned this result. Found by several searches usually means it is a big story.",
  preferred:
    "Sites you trust. Every issue runs one extra search limited to these sites, on top of the planned searches.",
  blocked: "Sites you never want. They are excluded from every search and dropped if they appear anyway.",
  searchLanguages:
    "Languages the searches are written in. Usually English, where most sources are, plus a local language for local topics. The issue is still written in the language above.",
  mustCover: "Kinds of stories you want. The planner, the triage model and the editor all read this.",
  avoid: "Kinds of stories that waste your time. Triage scores them down.",
  watchlist:
    "Companies, products, tools, creators and events worth following by name. Most real news comes from them, so at least half of every issue's searches name one of these.",
  coreQuery: "How people search for this subject in two to four words. Used to search your trusted sites.",
  subreddits: "Communities to search for discussion. The first one is added to Reddit searches.",
  youtube: "When on, the planner can search YouTube for new videos.",
  storyCount: "Maximum stories per issue. The editor may send fewer if there is not enough good material.",
  learned: "What was learned from your votes. Separate from the brief you wrote.",
} as const;
