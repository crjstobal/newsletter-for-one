-- Newsletters, their issues, the memory of what was sent, and every cent spent.

create table newsletters (
  id              text primary key,
  description     text not null,
  profile         jsonb not null,
  likes           jsonb not null default '[]',
  dislikes        jsonb not null default '[]',
  notes           text not null default '',
  auto_issues     boolean not null default false, -- written by the scheduled worker when due
  created_at      timestamptz not null default now(),
  last_issue_date date
);

create table issues (
  id            text primary key,
  newsletter_id text not null references newsletters(id) on delete cascade,
  number        integer not null,
  date          date not null,
  subject       text not null,
  intro         text not null,
  quiet         boolean not null default false,
  stories       jsonb not null,
  trace         jsonb not null,
  created_at    timestamptz not null default now(),
  unique (newsletter_id, number)
);
create index issues_newsletter_idx on issues (newsletter_id, number desc);

-- Every story ever sent: what the memory check compares new candidates against.
create table sent_stories (
  newsletter_id text not null references newsletters(id) on delete cascade,
  key           text not null,
  headline      text not null,
  summary       text,
  url           text,
  date          date not null,
  primary key (newsletter_id, key)
);

-- Every paid call, so the daily spending cap can be enforced before starting new work.
-- A row is written as a reservation with an estimate, then settled with the real cost.
create table spend (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  kind          text not null,          -- issue | brief | feedback
  newsletter_id text,
  issue_id      text,
  usd           numeric(12, 6) not null,
  settled       boolean not null default false
);
create index spend_at_idx on spend (at);

-- Runs of the scheduled worker, for visibility.
create table worker_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  trigger     text not null,            -- cli | web | nebius-job
  status      text not null default 'running', -- running | done | failed
  summary     text
);
