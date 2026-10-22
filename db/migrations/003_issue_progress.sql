-- The step an issue is on while it is being written, so the web app can show the progress of a
-- Nebius job it doesn't run itself. One row per newsletter, removed when the issue is done.

create table issue_progress (
  newsletter_id text primary key references newsletters(id) on delete cascade,
  step          text not null,
  detail        text,
  at            timestamptz not null default now()
);
