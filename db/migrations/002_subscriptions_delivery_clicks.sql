-- Delivery schedule, pausing, the reader's own subscriptions (newsletters by email, podcasts,
-- feeds) and the clicks that tell what the reader actually reads.

alter table newsletters
  add column delivery     jsonb,       -- {days: [0..6], hour: 0..23, timezone}; null = from cadence
  add column paused_at    timestamptz, -- set while paused: nothing is written or sent
  add column paused_until date,        -- optional automatic resume date
  add column window_floor date,        -- after "resume without catching up": never search before this
  add column inbox_token  text;

update newsletters set inbox_token = substr(md5(random()::text || id), 1, 12) where inbox_token is null;
alter table newsletters alter column inbox_token set not null;
create unique index newsletters_inbox_token_idx on newsletters (inbox_token);

-- What the reader follows directly. Newsletters arrive by email to the inbox address and need
-- no row here until the first one arrives (then a row is created per sender).
create table subscriptions (
  id              text primary key,
  newsletter_id   text not null references newsletters(id) on delete cascade,
  kind            text not null,       -- newsletter | podcast | feed
  name            text not null,
  url             text,                -- feed URL (podcasts, RSS); null for email newsletters
  sender          text,                -- email newsletters: the From address
  site            text,                -- homepage, for display
  image           text,
  added_at        timestamptz not null default now(),
  last_fetched_at timestamptz,
  last_error      text,
  unique (newsletter_id, url),
  unique (newsletter_id, sender)
);

-- Everything received from subscriptions: one email, one episode, one feed post.
create table inbox_items (
  id              text primary key,
  newsletter_id   text not null references newsletters(id) on delete cascade,
  subscription_id text references subscriptions(id) on delete cascade,
  kind            text not null,       -- newsletter | podcast | feed
  source_name     text not null,
  guid            text not null,       -- dedupe key: message id, episode guid or link
  title           text not null,
  url             text,
  content         text not null,       -- plain text: email body, transcript or show notes, post
  content_kind    text not null default 'text', -- text | transcript | show-notes
  links           jsonb not null default '[]',  -- links found in the item, for citing
  published_at    date not null,
  received_at     timestamptz not null default now(),
  extracted       jsonb,               -- cached split into separate news items
  unique (newsletter_id, guid)
);
create index inbox_items_window_idx on inbox_items (newsletter_id, published_at desc);

-- A click on a story link: the strongest signal of what the reader reads.
create table clicks (
  id            bigserial primary key,
  newsletter_id text not null references newsletters(id) on delete cascade,
  issue_id      text not null references issues(id) on delete cascade,
  story_index   integer not null,
  at            timestamptz not null default now()
);
create index clicks_newsletter_idx on clicks (newsletter_id, at desc);

-- "By the numbers": figures quoted from the sources, when the style asks for them.
alter table issues add column numbers jsonb;
