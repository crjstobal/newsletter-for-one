# Newsletter for One

**Stop subscribing to other people's newsletters. Describe the one you wish existed, and it
researches the web and writes it for you, every week, learning what you care about.**

Built for the Nebius x NVIDIA Global AI Hackathon, **Personal AI** track.

## How it works

1. **You describe it in your own words.** "I edit YouTube videos with Final Cut Pro. Every week:
   FCP updates, new plugins, useful tutorials and what the community is talking about." It turns
   that into an editable brief: audience, what to cover and skip, a watchlist of the companies and
   creators that make news in the niche, trusted sites, communities, language and cadence.
2. **Every issue, an agent does the research:**

   | Step | What happens | Runs on |
   |------|--------------|---------|
   | Plan | Decides what to search since the last issue, naming watchlist entries | Nemotron 3.5 Lightning |
   | Search | Web, news, Reddit, YouTube and trusted sites, limited to the window and the newsletter's languages | Tavily |
   | Score | Scores every result for this reader, labels its event and its language | Nemotron 3 Nano |
   | Verify dates | Opens each promising page and reads its real publication date | Page metadata, no model |
   | Filter | Drops old, undated, off-language, low-score and blocked results | Rules, no model |
   | Check memory | Compares candidates with every story ever sent: the same news is never sent twice | Nemotron 3.5 Lightning |
   | Write | Writes the issue in the reader's language, at most 2 stories per publisher | Nemotron 3 Ultra |

   Links always come from the search results, never from the model.
3. **You react, it remembers.** Mark stories useful or not, optionally with a reason. That becomes
   lasting preferences, visible and editable in Settings, that steer the next issue.

4. **It reads what you already follow, and tells each story once.** Every newsletter has its own
   inbox address: subscribe to other newsletters with it. Follow podcasts (searched in the Apple
   Podcasts directory, read from the transcript the publisher ships, or the show notes) and any
   site or Substack by its feed. Each issue splits what arrived into separate pieces of news
   (Nemotron 3 Nano with reasoning off: a mechanical job, about 100 times fewer tokens), merges
   them with the web results, and drops repeats. A launch covered by two newsletters, a podcast
   and a blog becomes one story that says "also in 3 more sources". Coverage is also a signal of
   importance: widely covered news ranks higher.
5. **It arrives when you want, how you want.** Pick the days of the week and the hour. Pick a
   style: straight, playful, short or deep dive, with optional jokes, a "by the numbers"
   infographic (figures copied from the sources, never computed) and a mind map of the issue.
   Pause it for a week without losing anything, then resume with a catch-up issue or fresh.
6. **It learns from what you open.** Story links count the click on the way out. What you open
   per theme and per source steers the next issue's searches and ranking, a weaker but honest
   signal next to your votes.

Every issue carries a full trace: each search, each result and why it was kept or dropped, each
model call, and the cost of all of it.

## NVIDIA Nemotron on Nebius Token Factory

| Job | Model | Why this one |
|-----|-------|--------------|
| Brief, search planning, memory check, learning from feedback | `nvidia/Nemotron-3_5-Lightning` | 1M-token context at the lowest price: reads the reader's whole history |
| Scoring every search result, short titles | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Cheapest and fast; runs over 100+ results per issue |
| Splitting newsletters and podcast transcripts into news items | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, reasoning off | Mechanical, so `enable_thinking: false`: a 38K-character transcript costs $0.0006. Judgment calls (same news?) keep reasoning on: we measured it gets them wrong without |
| Writing the issue | `nvidia/Nemotron-3-Ultra-550b-a55b` | NVIDIA's largest model where the reader sees the quality; about 3 cents per issue |

Prices are read live from Token Factory's `/v1/models` endpoint. A typical issue costs about
$0.19: $0.14 of Tavily search and $0.05 of Nemotron.

## Setup

Requirements: Node 22+, PostgreSQL 16+, a Nebius Token Factory API key, a Tavily API key.

```bash
npm install
createdb newsletter_for_one  # or set DATABASE_URL to any Postgres
npm run db:migrate
export NEBIUS_API_KEY=...    # or let lib/secrets.ts read it from AWS SSM
export TAVILY_API_KEY=...
npm run dev                  # web app on http://localhost:3000
```

## Automatic issues and the spending cap

Newsletters with **automatic issues** on are written by a worker when their next issue is due
(daily or weekly from the last one). `npm run worker` runs it once. In production it runs as a
**Nebius Serverless AI Job** on a small CPU VM, launched once a day by
[`.github/workflows/schedule.yml`](.github/workflows/schedule.yml) (Nebius jobs have no built-in
schedule) from the image built by [`worker-image.yml`](.github/workflows/worker-image.yml).
The schedule stays inactive until the repository variable `NEBIUS_JOBS_ENABLED` is `true`.

Everything that costs money (issues, briefs, learning from votes) goes through a **daily cap**
(`DAILY_CAP_EUR`, default 5). Work reserves its estimated cost before starting and records its
real cost when done, so neither the web app, the command line nor the worker can go over it.

Command line:

```bash
npm run cli -- create "A weekly newsletter about ..."
npm run cli -- issue <newsletterId>
npm run cli -- vote <issueId> 0:up 2:down:"too basic"
npm run worker               # write every automatic newsletter that is due
```

Inbound email: point any inbound-email provider (Postmark, SendGrid Inbound Parse, Mailgun, a
Cloudflare Email Worker) for `*@INBOX_DOMAIN` at `POST /api/inbound/email?key=INBOUND_SECRET`.
Locally, paste an email in the Subscriptions tab instead.

Secrets are read from environment variables, with an AWS SSM Parameter Store fallback for
local development. No key is ever stored in the repository.

## Architecture

```
lib/core/       vendor-free pipeline: profile, planner, subscriptions, triage, dedup, editor, memory, schedule
lib/adapters/   Nebius Token Factory (OpenAI-compatible), Tavily, page dates and images, feeds, email
lib/service.ts  application service: wires adapters, core and storage
lib/subscriptions.ts  inbox, podcasts, feeds and clicks (Postgres)
lib/budget.ts   daily spending cap (reserve, then settle the real cost)
lib/worker.ts   scheduled worker: writes the automatic newsletters that are due
db/migrations/  Postgres schema
app/            Next.js web app and API routes
scripts/        command line and one-off maintenance scripts
```

## License

MIT
