-- SEO rank history. The public site reads seo-rankings-data.json only.
-- Search Console revises recent days, so every capture upserts on the primary key.
-- Service role writes from GitHub Actions. anon and authenticated have no access.
-- Filename follows the Supabase CLI timestamp pattern. The CLI was not available
-- in this environment, so this file was added directly.

create table public.seo_rank_daily (
  date date not null,
  keyword text not null,
  market text not null,
  position numeric,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric,
  captured_at timestamptz not null default now(),
  primary key (date, keyword, market)
);

create table public.seo_page_rank_daily (
  date date not null,
  keyword text not null,
  market text not null,
  page_url text not null,
  position numeric,
  impressions integer not null default 0,
  clicks integer not null default 0,
  page_title text,
  captured_at timestamptz not null default now(),
  primary key (date, keyword, market, page_url)
);

create table public.seo_competitor_snapshots (
  checked_on date not null,
  keyword text not null,
  market text not null,
  position integer not null,
  url text,
  domain text,
  title text,
  type text,
  note text,
  method text,
  verified boolean,
  http_status integer,
  primary key (checked_on, keyword, market, position)
);

alter table public.seo_rank_daily enable row level security;
alter table public.seo_page_rank_daily enable row level security;
alter table public.seo_competitor_snapshots enable row level security;

revoke all on table public.seo_rank_daily from public, anon, authenticated;
revoke all on table public.seo_page_rank_daily from public, anon, authenticated;
revoke all on table public.seo_competitor_snapshots from public, anon, authenticated;

grant all on table public.seo_rank_daily to service_role;
grant all on table public.seo_page_rank_daily to service_role;
grant all on table public.seo_competitor_snapshots to service_role;
